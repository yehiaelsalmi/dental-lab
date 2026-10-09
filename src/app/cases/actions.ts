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
  notifyDesignerRedesign,
  notifyTryInReady,
  notifyPhotogrammetryDone,
  notifyPhotogrammetryNeeded,
  notifyStatusWatchers,
  notifyWorkReviewed,
  notifyWorkSubmitted,
} from "@/lib/notifications";
import {
  APPROVAL_ROUTES,
  CERAMIST_ASSIGNABLE_STATUSES,
  type ApprovalRoute,
  type CaseFileType,
  type CaseStatus,
  type ReviewDecision,
} from "@/lib/constants";
import { ceramistFeeFor, computeCasePricing, designerFeeFor } from "@/lib/pricing";
import {
  linesKey,
  parseLineInputs,
  pricedLinesForCase,
  priceLines,
  unitTotals,
} from "@/lib/caseMaterials";
import { activeDesignerId, isBeforeIbar } from "@/lib/caseFlow";
import { getStatuses, statusLabel } from "@/lib/statuses";
import { assertChecklistDone } from "@/lib/checklists";
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

  return prisma.caseFile.create({
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
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

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
    if (!["IN_DESIGN", "CHANGES_REQUESTED", "REDESIGN"].includes(caseRecord.status)) {
      throw new Error("This case can't be submitted for review right now.");
    }
    if (!caseRecord.driveFolderId) {
      throw new Error("This case has no Drive folder to upload into.");
    }
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

    const designFile = formData.get("designFile");
    if (!(designFile instanceof File) || designFile.size === 0) {
      throw new Error("Attach the design file before submitting for review.");
    }

    await attachFile(caseId, caseRecord.driveFolderId, designFile, "DESIGN", session.userId);

    // Every design goes to review; matching only happens after a try-in.
    const beforeIbar = isBeforeIbar(caseRecord);
    const redesign = caseRecord.status === "REDESIGN";
    await prisma.case.update({ where: { id: caseId }, data: { status: "WAITING_FOR_REVIEW" } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, "WAITING_FOR_REVIEW", session.userId);
    await notifyLabLeadersReviewReady(
      caseId,
      caseRecord.patientName,
      beforeIbar ? "design before ibar" : redesign ? "redesign after try-in" : undefined
    );
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function reviewCase(
  caseId: string,
  decision: ReviewDecision,
  comment: string | undefined,
  route?: ApprovalRoute
) {
  const session = await requirePermission("case.review");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (caseRecord.status !== "WAITING_FOR_REVIEW") {
      throw new Error("This case is not waiting for review.");
    }
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

    // Approving the design before the ibar sends the case to the ibar designer;
    // any other approval goes to printing or milling, as the reviewer picks.
    const beforeIbar = isBeforeIbar(caseRecord);
    if (decision === "APPROVED" && !beforeIbar && !(route && Object.hasOwn(APPROVAL_ROUTES, route))) {
      throw new Error("Pick where the case goes next: printing or milling.");
    }

    await prisma.caseReview.create({
      data: {
        caseId,
        decision,
        comment,
        reviewedById: session.userId,
      },
    });

    let next: CaseStatus;
    let production = {};
    if (decision !== "APPROVED") next = "CHANGES_REQUESTED";
    else if (beforeIbar) next = "IBAR_DESIGN";
    else {
      next = route === "MILL" ? "MILLING" : "PRINTING";
      production = { productionMethod: next, printForTryIn: route === "PRINT_TRYIN" };
    }
    await prisma.case.update({ where: { id: caseId }, data: { status: next, ...production } });
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
    if (!CERAMIST_ASSIGNABLE_STATUSES.includes(caseRecord.status as CaseStatus)) {
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
      throw new Error(`Only cases in ${await statusLabel("COMPLETED")} can be marked as delivered.`);
    }
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

    await prisma.case.update({ where: { id: caseId }, data: { status: "DELIVERED" } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, "DELIVERED", session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// Printing / Milling -> Stain & Glaze -> Completed (a print for a try-in goes
// to the doctor instead; see completeTryIn).
const PRODUCTION_STEPS: Record<string, { next: CaseStatus; permission: Permission }> = {
  PRINTING: { next: "STAIN_AND_GLAZE", permission: "case.printing" },
  MILLING: { next: "STAIN_AND_GLAZE", permission: "case.milling" },
  STAIN_AND_GLAZE: { next: "COMPLETED", permission: "case.stainGlaze" },
};

export async function advanceProduction(caseId: string) {
  const session = await requireAccess();

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    const step = PRODUCTION_STEPS[caseRecord.status];
    if (!step) throw new Error("This case isn't in printing, milling or stain & glaze.");
    // Each step has its own permission (e.g. a Milling role vs a Ceramist role).
    if (!can(session, step.permission)) {
      throw new Error("You don't have permission for this step.");
    }
    const next: CaseStatus =
      caseRecord.status === "PRINTING" && caseRecord.printForTryIn ? "TRY_IN" : step.next;
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

    await prisma.case.update({ where: { id: caseId }, data: { status: next } });
    await notifyStatusWatchers(caseId, caseRecord.patientName, next, session.userId);
    if (next === "TRY_IN") await notifyTryInReady(caseId, caseRecord.patientName, session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

// The doctor tried the print in; the new scans come back and the case goes to
// matching, then back to the designer for the redesign.
export async function completeTryIn(caseId: string, formData: FormData) {
  const session = await requirePermission("case.tryIn");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (caseRecord.status !== "TRY_IN") throw new Error("This case isn't at the doctor for a try-in.");
    if (!caseRecord.driveFolderId) throw new Error("This case has no Drive folder to upload into.");
    const files = formData.getAll("scanFiles").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new Error("Attach the new scans from the try-in.");
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

    for (const file of files) {
      await attachFile(caseId, caseRecord.driveFolderId, file, "SCAN", session.userId);
    }
    await prisma.case.update({
      where: { id: caseId },
      data: { status: "MATCHING", tryInDoneAt: new Date(), printForTryIn: false },
    });
    await notifyStatusWatchers(caseId, caseRecord.patientName, "MATCHING", session.userId);
    await notifyMatchingReady(caseId, caseRecord.patientName, caseRecord.matchingBy?.trim() || null);
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
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

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

// Someone working on the case (designer, ceramist or an assignable role like
// Milling) uploads a file for review. The case status doesn't change.
export async function submitWork(caseId: string, formData: FormData) {
  const session = await requirePermission("work.upload");

  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    const onCase =
      [caseRecord.assignedDesignerId, caseRecord.firstDesignerId, caseRecord.ceramistId].includes(session.userId) ||
      caseRecord.assignments.some((a) => a.userId === session.userId);
    if (!onCase) throw new Error("You can only upload work on cases you're assigned to.");
    if (!caseRecord.driveFolderId) throw new Error("This case has no Drive folder to upload into.");

    const file = formData.get("workFile");
    if (!(file instanceof File) || file.size === 0) throw new Error("Attach the file to submit.");
    const note = String(formData.get("note") ?? "").trim() || null;

    const saved = await attachFile(caseId, caseRecord.driveFolderId, file, "WORK", session.userId);
    await prisma.workSubmission.create({
      data: { caseId, fileId: saved.id, uploadedById: session.userId, roleName: session.role.name, note },
    });
    await notifyWorkSubmitted(caseId, caseRecord.patientName, session.name, session.role.name, session.userId);
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function reviewWork(submissionId: string, approved: boolean, comment: string | undefined) {
  const session = await requirePermission("case.reviewWork");
  const submission = await prisma.workSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) redirect("/cases");

  try {
    const caseRecord = await requireVisibleCase(session, submission.caseId);
    if (submission.status !== "PENDING") throw new Error("This upload was already reviewed.");
    await prisma.workSubmission.update({
      where: { id: submissionId },
      data: {
        status: approved ? "APPROVED" : "CHANGES_REQUESTED",
        reviewComment: comment?.trim() || null,
        reviewedById: session.userId,
        reviewedAt: new Date(),
      },
    });
    await notifyWorkReviewed(submission.caseId, caseRecord.patientName, submission.uploadedById, approved, comment?.trim() || null);
  } catch (error) {
    redirect(`/cases/${submission.caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath(`/cases/${submission.caseId}`);
}

// Ticks or unticks a checklist item in the case's current status. Anyone who
// can see the case can do it; who and when is recorded.
export async function toggleChecklistItem(caseId: string, key: string) {
  const session = await requireAccess();
  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    const [kind, id] = key.split(":");
    if (kind === "t") {
      const template = await prisma.checklistTemplateItem.findUnique({ where: { id } });
      if (!template || template.status !== caseRecord.status) throw new Error("That item isn't on this case's checklist.");
      const current = await prisma.caseChecklistItem.findUnique({
        where: { caseId_templateItemId: { caseId, templateItemId: id } },
      });
      const done = !current?.done;
      await prisma.caseChecklistItem.upsert({
        where: { caseId_templateItemId: { caseId, templateItemId: id } },
        create: { caseId, status: template.status, templateItemId: id, done, doneById: session.userId, doneAt: new Date() },
        update: { done, doneById: done ? session.userId : null, doneAt: done ? new Date() : null },
      });
    } else {
      const item = await prisma.caseChecklistItem.findUnique({ where: { id } });
      if (!item || item.caseId !== caseId || item.status !== caseRecord.status) {
        throw new Error("That item isn't on this case's checklist.");
      }
      const done = !item.done;
      await prisma.caseChecklistItem.update({
        where: { id },
        data: { done, doneById: done ? session.userId : null, doneAt: done ? new Date() : null },
      });
    }
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/cases/${caseId}`);
}

// An extra checklist item for just this case, in its current status.
export async function addCaseChecklistItem(caseId: string, text: string) {
  const session = await requirePermission("page.checklists");
  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    const clean = text.trim();
    if (!clean) throw new Error("Write the checklist item first.");
    await prisma.caseChecklistItem.create({ data: { caseId, status: caseRecord.status, text: clean.slice(0, 200) } });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/cases/${caseId}`);
}

export async function removeCaseChecklistItem(caseId: string, itemId: string) {
  const session = await requirePermission("page.checklists");
  try {
    await requireVisibleCase(session, caseId);
    await prisma.caseChecklistItem.deleteMany({ where: { id: itemId, caseId, templateItemId: null } });
  } catch (error) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/cases/${caseId}`);
}

// Any file, any time (permission "Upload files to a case at any time").
export async function uploadCaseFile(caseId: string, formData: FormData) {
  const session = await requirePermission("case.upload");
  try {
    const caseRecord = await requireVisibleCase(session, caseId);
    if (!caseRecord.driveFolderId) throw new Error("This case has no Drive folder to upload into.");
    const file = formData.get("caseFile");
    if (!(file instanceof File) || file.size === 0) throw new Error("Attach the file to upload.");
    await attachFile(caseId, caseRecord.driveFolderId, file, "OTHER", session.userId);
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
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

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
    await assertChecklistDone(caseId, caseRecord.status, await statusLabel(caseRecord.status));

    if (caseRecord.tryInDoneAt) {
      await prisma.case.update({ where: { id: caseId }, data: { status: "REDESIGN" } });
      await notifyStatusWatchers(caseId, caseRecord.patientName, "REDESIGN", session.userId);
      const designerId = activeDesignerId(caseRecord);
      if (designerId) await notifyDesignerRedesign(caseId, designerId, caseRecord.patientName);
    } else {
      await prisma.case.update({ where: { id: caseId }, data: { status: "WAITING_FOR_REVIEW" } });
      await notifyLabLeadersMatchingDone(caseId, caseRecord.patientName, session.userId);
      await notifyStatusWatchers(caseId, caseRecord.patientName, "WAITING_FOR_REVIEW", session.userId);
    }
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
