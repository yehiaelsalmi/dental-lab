"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createCaseFolder, uploadFileToDrive } from "@/lib/googleDrive";
import {
  notifyDesignerAssigned,
  notifyDesignerIbarDone,
  notifyLabLeadersAssigned,
  notifyLabLeadersReviewReady,
  notifyLabLeadersMatchingDone,
  notifyMatchingReady,
  notifyPhotogrammetryDone,
  notifyPhotogrammetryNeeded,
} from "@/lib/notifications";
import type { CaseFileType, ReviewDecision } from "@/lib/constants";
import { computeCasePricing } from "@/lib/pricing";
import { activeDesignerId, isBeforeIbar } from "@/lib/caseFlow";

const createCaseSchema = z.object({
  doctorId: z.string().min(1, "Select a doctor"),
  newDoctorName: z.string().optional(),
  materialId: z.string().min(1, "Select a material"),
  metalTypeId: z.string().optional(),
  ibarDesignerId: z.string().optional(),
  newIbarDesignerName: z.string().optional(),
  patientName: z.string().min(1, "Patient name is required"),
  unitsUpper: z.coerce.number().int().nonnegative().optional().nullable(),
  unitsLower: z.coerce.number().int().nonnegative().optional().nullable(),
  system: z.string().optional(),
  shade: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  matchingBy: z.string().trim().optional(),
  needsPhotogrammetry: z.boolean(),
  assignedDesignerId: z.string().optional(),
  firstDesignerId: z.string().optional(),
});

const CERAMIST_ASSIGNABLE_STATUSES = ["MATCHING", "WAITING_FOR_REVIEW", "MILLING", "STAIN_AND_GLAZE", "COMPLETED"];

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

function parseUnits(formData: FormData): { code: string }[] {
  return formData
    .getAll("unitCode")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((code) => ({ code }));
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
  const session = await requireRole("TECHNICIAN", "LAB_LEADER");

  const parsed = createCaseSchema.safeParse({
    doctorId: formData.get("doctorId"),
    newDoctorName: emptyToUndefined(formData.get("newDoctorName")),
    materialId: formData.get("materialId"),
    metalTypeId: emptyToUndefined(formData.get("metalTypeId")),
    ibarDesignerId: emptyToUndefined(formData.get("ibarDesignerId")),
    newIbarDesignerName: emptyToUndefined(formData.get("newIbarDesignerName")),
    patientName: formData.get("patientName"),
    unitsUpper: emptyToUndefined(formData.get("unitsUpper")),
    unitsLower: emptyToUndefined(formData.get("unitsLower")),
    system: emptyToUndefined(formData.get("system")),
    shade: emptyToUndefined(formData.get("shade")),
    dueDate: emptyToUndefined(formData.get("dueDate")),
    notes: emptyToUndefined(formData.get("notes")),
    matchingBy: emptyToUndefined(formData.get("matchingBy")),
    needsPhotogrammetry: formData.get("needsPhotogrammetry") === "on",
    assignedDesignerId: emptyToUndefined(formData.get("assignedDesignerId")),
    firstDesignerId: emptyToUndefined(formData.get("firstDesignerId")),
  });

  if (!parsed.success) {
    redirect(`/cases/new?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(", "))}`);
  }

  const data = parsed.data;
  const scanFile = formData.get("scanFile");

  let createdId: string;
  try {
    const units = parseUnits(formData);

    const doctor =
      data.doctorId === "__new__"
        ? await (async () => {
            const name = data.newDoctorName?.trim();
            if (!name) throw new Error("Enter the new doctor's name.");
            return prisma.doctor.upsert({ where: { name }, create: { name }, update: {} });
          })()
        : await prisma.doctor.findUniqueOrThrow({ where: { id: data.doctorId } });

    const ibarDesigner =
      data.ibarDesignerId === "__new__"
        ? await (async () => {
            const name = data.newIbarDesignerName?.trim();
            if (!name) throw new Error("Enter the new ibar designer's name.");
            return prisma.ibarDesigner.upsert({ where: { name }, create: { name }, update: {} });
          })()
        : data.ibarDesignerId
          ? await prisma.ibarDesigner.findUniqueOrThrow({ where: { id: data.ibarDesignerId } })
          : null;

    const material = await prisma.material.findUniqueOrThrow({ where: { id: data.materialId } });
    const metalType = data.metalTypeId
      ? await prisma.metalType.findUniqueOrThrow({ where: { id: data.metalTypeId } })
      : null;

    // A designer before the ibar only makes sense when there is an ibar.
    const firstDesignerId = ibarDesigner ? data.firstDesignerId : undefined;

    const pricing = computeCasePricing({
      material,
      metalCostPerUnit: metalType?.cost ?? null,
      unitCount: (data.unitsUpper ?? 0) + (data.unitsLower ?? 0),
      hasDesigner: !!data.assignedDesignerId,
      hasFirstDesigner: !!firstDesignerId,
      hasCeramist: false,
      hasIbarDesigner: !!ibarDesigner,
      needsPhotogrammetry: data.needsPhotogrammetry,
    });

    const folder = await createCaseFolder(doctor.name, data.patientName);

    const created = await prisma.case.create({
      data: {
        doctorId: doctor.id,
        ibarDesignerId: ibarDesigner?.id ?? null,
        materialId: material.id,
        metalTypeId: metalType?.id ?? null,
        ...pricing,
        units: { create: units },
        patientName: data.patientName,
        unitsUpper: data.unitsUpper ?? null,
        unitsLower: data.unitsLower ?? null,
        system: data.system,
        shade: data.shade,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
        matchingBy: data.matchingBy || null,
        needsPhotogrammetry: data.needsPhotogrammetry,
        assignedDesignerId: data.assignedDesignerId,
        firstDesignerId: firstDesignerId ?? null,
        driveFolderId: folder.id,
        driveFolderUrl: folder.url,
        createdById: session.user.id,
      },
    });

    if (scanFile instanceof File && scanFile.size > 0) {
      await attachFile(created.id, folder.id, scanFile, "SCAN", session.user.id);
    }

    if (data.needsPhotogrammetry) {
      await notifyPhotogrammetryNeeded(created.id, data.patientName);
    }

    // Only whoever works first is told now; on ibar cases the second designer
    // hears about it when the ibar is done (see completeIbar).
    const startsWith = ibarDesigner ? firstDesignerId : data.assignedDesignerId;
    if (startsWith) {
      await notifyDesignerAssigned(created.id, startsWith, data.patientName);
      await notifyLabLeadersAssigned(created.id, data.patientName, startsWith, session.user.id);
    }

    createdId = created.id;
  } catch (error) {
    redirect(`/cases/new?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/cases");
  redirect(`/cases/${createdId}`);
}

// `slot` "first" is the designer before the ibar; "second" is the assigned
// designer (the only one on cases without an ibar).
export async function assignDesigner(
  caseId: string,
  designerId: string | null,
  slot: "first" | "second" = "second"
) {
  const session = await requireRole("LAB_LEADER", "TECHNICIAN");

  try {
    const previous = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    const currentId = slot === "first" ? previous.firstDesignerId : previous.assignedDesignerId;

    let fee = slot === "first" ? previous.firstDesignerFee : previous.designerFee;
    if (designerId && designerId !== currentId) {
      const unitCount = (previous.unitsUpper ?? 0) + (previous.unitsLower ?? 0);
      const material = previous.materialId
        ? await prisma.material.findUnique({ where: { id: previous.materialId } })
        : null;
      fee = material ? material.designerFeePerUnit * unitCount : null;
    } else if (!designerId) {
      fee = null;
    }

    await prisma.case.update({
      where: { id: caseId },
      data:
        slot === "first"
          ? { firstDesignerId: designerId, firstDesignerFee: fee }
          : { assignedDesignerId: designerId, designerFee: fee },
    });

    // Tell them only if it's their turn; a second designer picked while the
    // case is still before the ibar is told when the ibar is done.
    const theirTurn =
      slot === "first"
        ? isBeforeIbar(previous) && previous.status !== "IBAR_DESIGN"
        : !isBeforeIbar(previous);
    if (designerId && designerId !== currentId && theirTurn) {
      await notifyDesignerAssigned(caseId, designerId, previous.patientName);
      await notifyLabLeadersAssigned(caseId, previous.patientName, designerId, session.user.id);
    }
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function startDesign(caseId: string) {
  const session = await requireRole("DESIGNER");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (activeDesignerId(caseRecord) !== session.user.id) {
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
    if (activeDesignerId(caseRecord) !== session.user.id) {
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

    // A case with someone named for matching goes there first; a Technician
    // or Lab Leader sends it on to review when matching is done. The design
    // before the ibar always goes straight to review.
    const beforeIbar = isBeforeIbar(caseRecord);
    const matchingBy = beforeIbar ? undefined : caseRecord.matchingBy?.trim();
    await prisma.case.update({
      where: { id: caseId },
      data: { status: matchingBy ? "MATCHING" : "WAITING_FOR_REVIEW" },
    });

    if (matchingBy) {
      await notifyMatchingReady(caseId, caseRecord.patientName, matchingBy);
    } else {
      await notifyLabLeadersReviewReady(
        caseId,
        caseRecord.patientName,
        beforeIbar ? "design before ibar" : undefined
      );
    }
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
      // Approving the design before the ibar sends the case to the ibar designer.
      data: {
        status:
          decision !== "APPROVED"
            ? "CHANGES_REQUESTED"
            : isBeforeIbar(caseRecord)
              ? "IBAR_DESIGN"
              : "MILLING",
      },
    });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function assignCeramist(
  caseId: string,
  ceramistId: string | undefined,
  newCeramistName: string | undefined
) {
  await requireRole("LAB_LEADER", "TECHNICIAN");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (!CERAMIST_ASSIGNABLE_STATUSES.includes(caseRecord.status)) {
      throw new Error("The ceramist can be assigned once the design has been submitted.");
    }

    let resolvedId: string | null = null;
    if (ceramistId === "__new__") {
      const name = newCeramistName?.trim();
      if (!name) throw new Error("Enter the new ceramist's name.");
      const ceramist = await prisma.ceramist.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      resolvedId = ceramist.id;
    } else if (ceramistId) {
      resolvedId = (await prisma.ceramist.findUniqueOrThrow({ where: { id: ceramistId } })).id;
    }

    let ceramistFee: number | null = null;
    if (resolvedId) {
      const unitCount = (caseRecord.unitsUpper ?? 0) + (caseRecord.unitsLower ?? 0);
      const material = caseRecord.materialId
        ? await prisma.material.findUnique({ where: { id: caseRecord.materialId } })
        : null;
      ceramistFee = material ? material.ceramistFeePerUnit * unitCount : null;
    }

    await prisma.case.update({
      where: { id: caseId },
      data: { ceramistId: resolvedId, ceramistFee },
    });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function markDelivered(caseId: string) {
  await requireRole("LAB_LEADER", "TECHNICIAN");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (caseRecord.status !== "COMPLETED") {
      throw new Error("Only completed cases can be marked as delivered.");
    }
    await prisma.case.update({ where: { id: caseId }, data: { status: "DELIVERED" } });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// Milling -> Stain & Glaze -> Completed.
export async function advanceProduction(caseId: string) {
  await requireRole("LAB_LEADER", "TECHNICIAN");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    const next =
      caseRecord.status === "MILLING"
        ? "STAIN_AND_GLAZE"
        : caseRecord.status === "STAIN_AND_GLAZE"
          ? "COMPLETED"
          : null;
    if (!next) throw new Error("This case isn't in milling or stain & glaze.");

    await prisma.case.update({ where: { id: caseId }, data: { status: next } });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// Ibar Design -> Ready for Design, handing the case to the second designer.
export async function completeIbar(caseId: string, formData: FormData) {
  const session = await requireRole("LAB_LEADER", "TECHNICIAN");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (caseRecord.status !== "IBAR_DESIGN") throw new Error("This case isn't in ibar design.");

    const file = formData.get("ibarFile");
    if (file instanceof File && file.size > 0) {
      if (!caseRecord.driveFolderId) throw new Error("This case has no Drive folder to upload into.");
      await attachFile(caseId, caseRecord.driveFolderId, file, "IBAR", session.user.id);
    }

    await prisma.case.update({
      where: { id: caseId },
      data: { status: "READY_FOR_DESIGN", ibarDoneAt: new Date() },
    });
    await handOffAfterIbar(caseRecord, session.user.id);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

async function handOffAfterIbar(
  c: { id: string; patientName: string; assignedDesignerId: string | null },
  actorId: string
) {
  if (!c.assignedDesignerId) return;
  await notifyDesignerIbarDone(c.id, c.assignedDesignerId, c.patientName);
  await notifyLabLeadersAssigned(c.id, c.patientName, c.assignedDesignerId, actorId);
}

export async function completeMatching(caseId: string) {
  const session = await requireRole("LAB_LEADER", "TECHNICIAN");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (caseRecord.status !== "MATCHING") throw new Error("This case isn't in matching.");

    await prisma.case.update({ where: { id: caseId }, data: { status: "WAITING_FOR_REVIEW" } });
    await notifyLabLeadersMatchingDone(caseId, caseRecord.patientName, session.user.id);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// Photogrammetry runs alongside the main flow; it doesn't change the status.
export async function markPhotogrammetryDone(caseId: string, formData: FormData) {
  const session = await requireRole("PHOTOGRAMMETRY", "LAB_LEADER", "TECHNICIAN");

  try {
    const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (!caseRecord.needsPhotogrammetry) {
      throw new Error("This case doesn't need photogrammetry.");
    }
    if (caseRecord.photogrammetryDoneAt) throw new Error("Photogrammetry is already done.");

    const file = formData.get("photogrammetryFile");
    if (file instanceof File && file.size > 0) {
      if (!caseRecord.driveFolderId) throw new Error("This case has no Drive folder to upload into.");
      await attachFile(caseId, caseRecord.driveFolderId, file, "PHOTOGRAMMETRY", session.user.id);
    }

    await prisma.case.update({ where: { id: caseId }, data: { photogrammetryDoneAt: new Date() } });
    await notifyPhotogrammetryDone(caseId, caseRecord.patientName, session.user.id);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

const updateCaseSchema = createCaseSchema.omit({ assignedDesignerId: true });

export async function updateCase(formData: FormData) {
  const session = await requireRole("TECHNICIAN", "LAB_LEADER");
  const caseId = formData.get("caseId") as string;

  const parsed = updateCaseSchema.safeParse({
    doctorId: formData.get("doctorId"),
    newDoctorName: emptyToUndefined(formData.get("newDoctorName")),
    materialId: formData.get("materialId"),
    metalTypeId: emptyToUndefined(formData.get("metalTypeId")),
    ibarDesignerId: emptyToUndefined(formData.get("ibarDesignerId")),
    newIbarDesignerName: emptyToUndefined(formData.get("newIbarDesignerName")),
    patientName: formData.get("patientName"),
    unitsUpper: emptyToUndefined(formData.get("unitsUpper")),
    unitsLower: emptyToUndefined(formData.get("unitsLower")),
    system: emptyToUndefined(formData.get("system")),
    shade: emptyToUndefined(formData.get("shade")),
    dueDate: emptyToUndefined(formData.get("dueDate")),
    notes: emptyToUndefined(formData.get("notes")),
    matchingBy: emptyToUndefined(formData.get("matchingBy")),
    needsPhotogrammetry: formData.get("needsPhotogrammetry") === "on",
  });

  if (!parsed.success) {
    redirect(
      `/cases/${caseId}/edit?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(", "))}`
    );
  }
  const data = parsed.data;

  try {
    const previous = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    const units = parseUnits(formData);

    const doctor =
      data.doctorId === "__new__"
        ? await (async () => {
            const name = data.newDoctorName?.trim();
            if (!name) throw new Error("Enter the new doctor's name.");
            return prisma.doctor.upsert({ where: { name }, create: { name }, update: {} });
          })()
        : await prisma.doctor.findUniqueOrThrow({ where: { id: data.doctorId } });

    const ibarDesigner =
      data.ibarDesignerId === "__new__"
        ? await (async () => {
            const name = data.newIbarDesignerName?.trim();
            if (!name) throw new Error("Enter the new ibar designer's name.");
            return prisma.ibarDesigner.upsert({ where: { name }, create: { name }, update: {} });
          })()
        : data.ibarDesignerId
          ? await prisma.ibarDesigner.findUniqueOrThrow({ where: { id: data.ibarDesignerId } })
          : null;

    const material = await prisma.material.findUniqueOrThrow({ where: { id: data.materialId } });
    const metalType = data.metalTypeId
      ? await prisma.metalType.findUniqueOrThrow({ where: { id: data.metalTypeId } })
      : null;

    const unitsUpper = data.unitsUpper ?? null;
    const unitsLower = data.unitsLower ?? null;

    // Locked-in amounts are only recalculated when something that affects
    // money changed; correcting a name or a note leaves them alone.
    const pricingChanged =
      previous.materialId !== material.id ||
      previous.metalTypeId !== (metalType?.id ?? null) ||
      previous.ibarDesignerId !== (ibarDesigner?.id ?? null) ||
      previous.unitsUpper !== unitsUpper ||
      previous.unitsLower !== unitsLower ||
      previous.needsPhotogrammetry !== data.needsPhotogrammetry;

    // An ibar designer added before any design starts means the first
    // designer goes first; added later, it's only recorded (treated as done).
    // Removing it while waiting for the ibar releases the case to the designer.
    const hasIbar = !!ibarDesigner;
    const ibarDoneAt = !hasIbar
      ? null
      : previous.ibarDesignerId
        ? previous.ibarDoneAt
        : previous.status === "READY_FOR_DESIGN"
          ? null
          : new Date();
    const status =
      !hasIbar && previous.status === "IBAR_DESIGN" ? "READY_FOR_DESIGN" : previous.status;

    const pricing = pricingChanged
      ? computeCasePricing({
          material,
          metalCostPerUnit: metalType?.cost ?? null,
          unitCount: (unitsUpper ?? 0) + (unitsLower ?? 0),
          hasDesigner: !!previous.assignedDesignerId,
          hasFirstDesigner: !!previous.firstDesignerId,
          hasCeramist: !!previous.ceramistId,
          hasIbarDesigner: !!ibarDesigner,
          needsPhotogrammetry: data.needsPhotogrammetry,
        })
      : {};

    await prisma.case.update({
      where: { id: caseId },
      data: {
        doctorId: doctor.id,
        patientName: data.patientName,
        unitsUpper,
        unitsLower,
        materialId: material.id,
        metalTypeId: metalType?.id ?? null,
        ibarDesignerId: ibarDesigner?.id ?? null,
        status,
        ibarDoneAt,
        system: data.system ?? null,
        shade: data.shade ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes ?? null,
        matchingBy: data.matchingBy || null,
        needsPhotogrammetry: data.needsPhotogrammetry,
        // Unticking clears "done", so ticking it again starts fresh.
        ...(data.needsPhotogrammetry ? {} : { photogrammetryDoneAt: null }),
        units: { deleteMany: {}, create: units },
        ...pricing,
      },
    });

    if (data.needsPhotogrammetry && !previous.needsPhotogrammetry) {
      await notifyPhotogrammetryNeeded(caseId, data.patientName);
    }
    if (previous.status === "IBAR_DESIGN" && status === "READY_FOR_DESIGN") {
      await handOffAfterIbar(
        { id: caseId, patientName: data.patientName, assignedDesignerId: previous.assignedDesignerId },
        session.user.id
      );
    }
  } catch (error) {
    redirect(`/cases/${caseId}/edit?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  redirect(`/cases/${caseId}`);
}

export async function deleteCase(formData: FormData) {
  await requireRole("LAB_LEADER");
  const caseId = formData.get("caseId") as string;

  try {
    await prisma.case.delete({ where: { id: caseId } });
  } catch (error) {
    redirect(`/cases/${caseId}/edit?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/cases");
  redirect("/cases");
}
