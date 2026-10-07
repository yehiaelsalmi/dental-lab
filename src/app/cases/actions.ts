"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  can,
  requireAccess,
  requirePermission,
  requireVisibleCase,
  toRoleAccess,
} from "@/lib/access";
import type { Permission } from "@/lib/permissions";
import { createCaseFolder, uploadFileToDrive } from "@/lib/googleDrive";
import {
  notifyCeramistAssigned,
  notifyRoleAssigned,
  notifyDesignerAssigned,
  notifyDesignerIbarDone,
  notifyLabLeadersAssigned,
  notifyLabLeadersReviewReady,
  notifyLabLeadersMatchingDone,
  notifyMatchingReady,
  notifyPhotogrammetryDone,
  notifyPhotogrammetryNeeded,
  notifyStatusWatchers,
} from "@/lib/notifications";
import type { CaseFileType, CaseStatus, ReviewDecision } from "@/lib/constants";
import { ceramistFeeFor, computeCasePricing, designerFeeFor } from "@/lib/pricing";
import {
  linesKey,
  parseLineInputs,
  pricedLinesForCase,
  priceLines,
  unitTotals,
} from "@/lib/caseMaterials";
import { activeDesignerId, isBeforeIbar } from "@/lib/caseFlow";
import { getStatuses } from "@/lib/statuses";
import { activeFields, parseFieldValues, saveFieldValues } from "@/lib/customFields";

const createCaseSchema = z.object({
  doctorId: z.string().min(1, "Select a doctor"),
  newDoctorName: z.string().optional(),
  ibarDesignerId: z.string().optional(),
  newIbarDesignerName: z.string().optional(),
  patientName: z.string().min(1, "Patient name is required"),
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

// A designer or ceramist must be an active user whose role allows that work.
async function assertCanWork(userId: string, permission: Permission, what: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || !user.active || !toRoleAccess(user.role).permissions.has(permission)) {
    throw new Error(`That person can't be assigned as ${what}.`);
  }
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
  const session = await requirePermission("case.create");

  const parsed = createCaseSchema.safeParse({
    doctorId: formData.get("doctorId") ?? "",
    newDoctorName: emptyToUndefined(formData.get("newDoctorName")),
    ibarDesignerId: emptyToUndefined(formData.get("ibarDesignerId")),
    newIbarDesignerName: emptyToUndefined(formData.get("newIbarDesignerName")),
    patientName: formData.get("patientName") ?? "",
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
    const lineInputs = parseLineInputs(formData);
    const pricedLines = await priceLines(lineInputs);
    const fieldValues = parseFieldValues(formData, await activeFields());

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

    // A designer before the ibar only makes sense when there is an ibar.
    const firstDesignerId = ibarDesigner ? data.firstDesignerId : undefined;
    if (data.assignedDesignerId) await assertCanWork(data.assignedDesignerId, "work.design", "a designer");
    if (firstDesignerId) await assertCanWork(firstDesignerId, "work.design", "a designer");

    const pricing = computeCasePricing({
      lines: pricedLines,
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
        ...pricing,
        units: { create: units },
        materials: { create: lineInputs },
        ...unitTotals(lineInputs),
        patientName: data.patientName,
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
        createdById: session.userId,
      },
    });

    await saveFieldValues(created.id, fieldValues);

    if (scanFile instanceof File && scanFile.size > 0) {
      await attachFile(created.id, folder.id, scanFile, "SCAN", session.userId);
    }

    if (data.needsPhotogrammetry) {
      await notifyPhotogrammetryNeeded(created.id, data.patientName);
    }

    // Only whoever works first is told now; on ibar cases the second designer
    // hears about it when the ibar is done (see completeIbar).
    const startsWith = ibarDesigner ? firstDesignerId : data.assignedDesignerId;
    if (startsWith) {
      await notifyDesignerAssigned(created.id, startsWith, data.patientName);
      await notifyLabLeadersAssigned(created.id, data.patientName, startsWith, session.userId);
    }
    await notifyStatusWatchers(created.id, data.patientName, "READY_FOR_DESIGN", session.userId);

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
  const session = await requirePermission("case.assign");

  try {
    const previous = await requireVisibleCase(session, caseId);
    const currentId = slot === "first" ? previous.firstDesignerId : previous.assignedDesignerId;
    if (designerId) await assertCanWork(designerId, "work.design", "a designer");

    let fee = slot === "first" ? previous.firstDesignerFee : previous.designerFee;
    if (designerId && designerId !== currentId) {
      fee = designerFeeFor(await pricedLinesForCase(caseId));
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
      await notifyLabLeadersAssigned(caseId, previous.patientName, designerId, session.userId);
    }
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function startDesign(caseId: string) {
  const session = await requirePermission("work.design");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (activeDesignerId(caseRecord) !== session.userId) {
      throw new Error("This case isn't assigned to you.");
    }
    if (caseRecord.status !== "READY_FOR_DESIGN") {
      throw new Error("This case is not ready to start.");
    }

    await prisma.case.update({
      where: { id: caseId },
      data: { status: "IN_DESIGN" },
    });
    await notifyStatusWatchers(caseId, caseRecord.patientName, "IN_DESIGN", session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function submitForReview(caseId: string, formData: FormData) {
  const session = await requirePermission("work.design");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (activeDesignerId(caseRecord) !== session.userId) {
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

    await attachFile(caseId, caseRecord.driveFolderId, designFile, "DESIGN", session.userId);

    // A case with someone named for matching goes there first; a Technician
    // or Lab Leader sends it on to review when matching is done. The design
    // before the ibar always goes straight to review.
    const beforeIbar = isBeforeIbar(caseRecord);
    const matchingBy = beforeIbar ? undefined : caseRecord.matchingBy?.trim();
    const next: CaseStatus = matchingBy ? "MATCHING" : "WAITING_FOR_REVIEW";
    await prisma.case.update({ where: { id: caseId }, data: { status: next } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, next, session.userId);

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
  const session = await requirePermission("case.review");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (caseRecord.status !== "WAITING_FOR_REVIEW") {
      throw new Error("This case is not waiting for review.");
    }

    await prisma.caseReview.create({
      data: {
        caseId,
        decision,
        comment,
        reviewedById: session.userId,
      },
    });

    // Approving the design before the ibar sends the case to the ibar designer.
    const next: CaseStatus =
      decision !== "APPROVED"
        ? "CHANGES_REQUESTED"
        : isBeforeIbar(caseRecord)
          ? "IBAR_DESIGN"
          : "MILLING";
    await prisma.case.update({ where: { id: caseId }, data: { status: next } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, next, session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function assignCeramist(caseId: string, ceramistId: string | undefined) {
  const session = await requirePermission("case.assign");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (!CERAMIST_ASSIGNABLE_STATUSES.includes(caseRecord.status)) {
      throw new Error("The ceramist can be assigned once the design has been submitted.");
    }

    const resolvedId = ceramistId || null;
    if (resolvedId) await assertCanWork(resolvedId, "work.ceramist", "a ceramist");
    // Changing nothing keeps the fee that was locked when they were assigned.
    if (resolvedId === caseRecord.ceramistId) return;

    let ceramistFee: number | null = null;
    if (resolvedId) ceramistFee = ceramistFeeFor(await pricedLinesForCase(caseId));

    await prisma.case.update({
      where: { id: caseId },
      data: { ceramistId: resolvedId, ceramistFee },
    });
    if (resolvedId) await notifyCeramistAssigned(caseId, resolvedId, caseRecord.patientName);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function markDelivered(caseId: string) {
  const session = await requirePermission("case.deliver");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (caseRecord.status !== "COMPLETED") {
      throw new Error("Only completed cases can be marked as delivered.");
    }
    await prisma.case.update({ where: { id: caseId }, data: { status: "DELIVERED" } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, "DELIVERED", session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// Milling -> Stain & Glaze -> Completed.
export async function advanceProduction(caseId: string) {
  const session = await requireAccess();

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    const next: CaseStatus | null =
      caseRecord.status === "MILLING"
        ? "STAIN_AND_GLAZE"
        : caseRecord.status === "STAIN_AND_GLAZE"
          ? "COMPLETED"
          : null;
    if (!next) throw new Error("This case isn't in milling or stain & glaze.");
    // Each step has its own permission (e.g. a Milling role vs a Ceramist role).
    if (!can(session, caseRecord.status === "MILLING" ? "case.milling" : "case.stainGlaze")) {
      throw new Error("You don't have permission for this step.");
    }

    await prisma.case.update({ where: { id: caseId }, data: { status: next } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, next, session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// Ibar Design -> Ready for Design, handing the case to the second designer.
export async function completeIbar(caseId: string, formData: FormData) {
  const session = await requirePermission("case.ibar");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (caseRecord.status !== "IBAR_DESIGN") throw new Error("This case isn't in ibar design.");

    const file = formData.get("ibarFile");
    if (file instanceof File && file.size > 0) {
      if (!caseRecord.driveFolderId) throw new Error("This case has no Drive folder to upload into.");
      await attachFile(caseId, caseRecord.driveFolderId, file, "IBAR", session.userId);
    }

    await prisma.case.update({
      where: { id: caseId },
      data: { status: "READY_FOR_DESIGN", ibarDoneAt: new Date() },
    });
    await handOffAfterIbar(caseRecord, session.userId);
    await notifyStatusWatchers(caseId, caseRecord.patientName, "READY_FOR_DESIGN", session.userId);
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

// Puts a person from an assignable role (milling, printing, ...) on a case, at
// any stage; an empty userId removes them. Their fee (role fee per unit x the
// case's units) is locked now.
export async function assignRolePerson(caseId: string, roleId: string, userId: string | null) {
  const session = await requirePermission("case.assign");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role || !role.assignable) throw new Error("That role can't be assigned to cases.");
    const current = await prisma.caseAssignment.findUnique({
      where: { caseId_roleId: { caseId, roleId } },
    });

    if (!userId) {
      if (current) await prisma.caseAssignment.delete({ where: { id: current.id } });
    } else if (userId !== current?.userId) {
      const person = await prisma.user.findUnique({ where: { id: userId } });
      if (!person || !person.active || person.roleId !== roleId) {
        throw new Error(`That person doesn't have the ${role.name} role.`);
      }
      const units = (caseRecord.unitsUpper ?? 0) + (caseRecord.unitsLower ?? 0);
      const fee = role.feePerUnit != null ? role.feePerUnit * units : null;
      await prisma.caseAssignment.upsert({
        where: { caseId_roleId: { caseId, roleId } },
        create: { caseId, roleId, userId, fee },
        update: { userId, fee },
      });
      await notifyRoleAssigned(caseId, userId, role.name, caseRecord.patientName);
    }
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

// Manual move to any status (built-in or custom). Only the status changes:
// none of the automatic steps run, but roles watching that status are told.
export async function setCaseStatus(caseId: string, status: string) {
  const session = await requirePermission("case.setStatus");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    const statuses = await getStatuses();
    if (!statuses.some((s) => s.key === status)) throw new Error("Pick a status.");
    if (status === caseRecord.status) return;

    await prisma.case.update({ where: { id: caseId }, data: { status } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, status, session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

export async function completeMatching(caseId: string) {
  const session = await requirePermission("case.matching");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (caseRecord.status !== "MATCHING") throw new Error("This case isn't in matching.");

    await prisma.case.update({ where: { id: caseId }, data: { status: "WAITING_FOR_REVIEW" } });
    await notifyLabLeadersMatchingDone(caseId, caseRecord.patientName, session.userId);
    await notifyStatusWatchers(caseId, caseRecord.patientName, "WAITING_FOR_REVIEW", session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// Photogrammetry runs alongside the main flow; it doesn't change the status.
export async function markPhotogrammetryDone(caseId: string, formData: FormData) {
  const session = await requirePermission("case.photogrammetry");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (!caseRecord.needsPhotogrammetry) {
      throw new Error("This case doesn't need photogrammetry.");
    }
    if (caseRecord.photogrammetryDoneAt) throw new Error("Photogrammetry is already done.");

    const file = formData.get("photogrammetryFile");
    if (file instanceof File && file.size > 0) {
      if (!caseRecord.driveFolderId) throw new Error("This case has no Drive folder to upload into.");
      await attachFile(caseId, caseRecord.driveFolderId, file, "PHOTOGRAMMETRY", session.userId);
    }

    await prisma.case.update({
      where: { id: caseId },
      data: { photogrammetryDoneAt: new Date(), photogrammetryDoneById: session.userId },
    });
    await notifyPhotogrammetryDone(caseId, caseRecord.patientName, session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

const updateCaseSchema = createCaseSchema.omit({ assignedDesignerId: true });

export async function updateCase(formData: FormData) {
  const session = await requirePermission("case.edit");
  const caseId = formData.get("caseId") as string;

  const parsed = updateCaseSchema.safeParse({
    doctorId: formData.get("doctorId") ?? "",
    newDoctorName: emptyToUndefined(formData.get("newDoctorName")),
    ibarDesignerId: emptyToUndefined(formData.get("ibarDesignerId")),
    newIbarDesignerName: emptyToUndefined(formData.get("newIbarDesignerName")),
    patientName: formData.get("patientName") ?? "",
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
    const previous = await requireVisibleCase(session, caseId);
    const previousLines = await prisma.caseMaterial.findMany({ where: { caseId } });
    const units = parseUnits(formData);
    const lineInputs = parseLineInputs(formData);
    const pricedLines = await priceLines(lineInputs);
    const fieldValues = parseFieldValues(formData, await activeFields());

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


    // Locked-in amounts are only recalculated when something that affects
    // money changed; correcting a name or a note leaves them alone.
    const pricingChanged =
      linesKey(previousLines) !== linesKey(lineInputs) ||
      previous.ibarDesignerId !== (ibarDesigner?.id ?? null) ||
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
          lines: pricedLines,
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
        ...unitTotals(lineInputs),
        materials: { deleteMany: {}, create: lineInputs },
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
        ...(data.needsPhotogrammetry ? {} : { photogrammetryDoneAt: null, photogrammetryDoneById: null }),
        units: { deleteMany: {}, create: units },
        ...pricing,
      },
    });

    await saveFieldValues(caseId, fieldValues);

    if (data.needsPhotogrammetry && !previous.needsPhotogrammetry) {
      await notifyPhotogrammetryNeeded(caseId, data.patientName);
    }
    if (previous.status === "IBAR_DESIGN" && status === "READY_FOR_DESIGN") {
      await handOffAfterIbar(
        { id: caseId, patientName: data.patientName, assignedDesignerId: previous.assignedDesignerId },
        session.userId
      );
    }
    if (status !== previous.status) {
      await notifyStatusWatchers(caseId, data.patientName, status as CaseStatus, session.userId);
    }
  } catch (error) {
    redirect(`/cases/${caseId}/edit?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  redirect(`/cases/${caseId}`);
}

export async function deleteCase(formData: FormData) {
  const session = await requirePermission("case.delete");
  const caseId = formData.get("caseId") as string;

  try {
    await requireVisibleCase(session, caseId);
    await prisma.case.delete({ where: { id: caseId } });
  } catch (error) {
    redirect(`/cases/${caseId}/edit?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/cases");
  redirect("/cases");
}
