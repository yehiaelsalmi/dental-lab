"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createCaseFolder, uploadFileToDrive } from "@/lib/googleDrive";
import type { CaseFileType, ReviewDecision } from "@/lib/constants";

const createCaseSchema = z.object({
  doctorName: z.string().min(1, "Doctor name is required"),
  patientName: z.string().min(1, "Patient name is required"),
  unitsUpper: z.coerce.number().int().nonnegative().optional().nullable(),
  unitsLower: z.coerce.number().int().nonnegative().optional().nullable(),
  material: z.string().optional(),
  system: z.string().optional(),
  shade: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  assignedDesignerId: z.string().optional(),
});

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function attachFile(
  caseId: string,
  folderId: string,
  file: File,
  type: CaseFileType,
  uploadedById: string
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadFileToDrive(
    folderId,
    file.name,
    file.type || "application/octet-stream",
    buffer
  );

  await prisma.caseFile.create({
    data: {
      caseId,
      type,
      fileName: file.name,
      driveFileId: uploaded.id,
      driveLink: uploaded.url,
      uploadedById,
    },
  });
}

export async function createCase(formData: FormData) {
  const session = await requireRole("DATA_ENTRY", "LAB_LEADER");

  const parsed = createCaseSchema.safeParse({
    doctorName: formData.get("doctorName"),
    patientName: formData.get("patientName"),
    unitsUpper: emptyToUndefined(formData.get("unitsUpper")),
    unitsLower: emptyToUndefined(formData.get("unitsLower")),
    material: emptyToUndefined(formData.get("material")),
    system: emptyToUndefined(formData.get("system")),
    shade: emptyToUndefined(formData.get("shade")),
    dueDate: emptyToUndefined(formData.get("dueDate")),
    notes: emptyToUndefined(formData.get("notes")),
    assignedDesignerId: emptyToUndefined(formData.get("assignedDesignerId")),
  });

  if (!parsed.success) {
    redirect(`/cases/new?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(", "))}`);
  }

  const data = parsed.data;
  const scanFile = formData.get("scanFile");

  let createdId: string;
  try {
    const folder = await createCaseFolder(`${data.patientName} - ${data.doctorName}`);

    const created = await prisma.case.create({
      data: {
        doctorName: data.doctorName,
        patientName: data.patientName,
        unitsUpper: data.unitsUpper ?? null,
        unitsLower: data.unitsLower ?? null,
        material: data.material,
        system: data.system,
        shade: data.shade,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
        assignedDesignerId: data.assignedDesignerId,
        driveFolderId: folder.id,
        driveFolderUrl: folder.url,
        createdById: session.user.id,
      },
    });

    if (scanFile instanceof File && scanFile.size > 0) {
      await attachFile(created.id, folder.id, scanFile, "SCAN", session.user.id);
    }

    createdId = created.id;
  } catch (error) {
    redirect(`/cases/new?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/cases");
  redirect(`/cases/${createdId}`);
}

export async function assignDesigner(caseId: string, designerId: string | null) {
  await requireRole("LAB_LEADER", "DATA_ENTRY");

  try {
    await prisma.case.update({
      where: { id: caseId },
      data: { assignedDesignerId: designerId },
    });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function startDesign(caseId: string) {
  const session = await requireRole("DESIGNER");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (caseRecord.assignedDesignerId !== session.user.id) {
      throw new Error("This case isn't assigned to you.");
    }
    if (caseRecord.status !== "READY_FOR_DESIGN") {
      throw new Error("This case is not ready to start.");
    }

    await prisma.case.update({
      where: { id: caseId },
      data: { status: "IN_DESIGN" },
    });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function submitForReview(caseId: string, formData: FormData) {
  const session = await requireRole("DESIGNER");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (caseRecord.assignedDesignerId !== session.user.id) {
      throw new Error("This case isn't assigned to you.");
    }
    if (!["IN_DESIGN", "CHANGES_REQUESTED"].includes(caseRecord.status)) {
      throw new Error("This case can't be submitted for review right now.");
    }
    if (!caseRecord.driveFolderId) {
      throw new Error("This case has no Drive folder to upload into.");
    }

    const designFile = formData.get("designFile");
    if (!(designFile instanceof File) || designFile.size === 0) {
      throw new Error("Attach the design file before submitting for review.");
    }

    await attachFile(caseId, caseRecord.driveFolderId, designFile, "DESIGN", session.user.id);

    await prisma.case.update({
      where: { id: caseId },
      data: { status: "WAITING_FOR_REVIEW" },
    });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function reviewCase(
  caseId: string,
  decision: ReviewDecision,
  comment: string | undefined
) {
  const session = await requireRole("LAB_LEADER");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (caseRecord.status !== "WAITING_FOR_REVIEW") {
      throw new Error("This case is not waiting for review.");
    }

    await prisma.caseReview.create({
      data: {
        caseId,
        decision,
        comment,
        reviewedById: session.user.id,
      },
    });

    await prisma.case.update({
      where: { id: caseId },
      data: { status: decision === "APPROVED" ? "COMPLETED" : "CHANGES_REQUESTED" },
    });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}
