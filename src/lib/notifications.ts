import { prisma } from "@/lib/prisma";
import { caseUrl, sendEmail } from "@/lib/email";

async function activeUsers(roles: string[], excludeUserId?: string) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, active: true },
    select: { id: true, email: true },
  });
  return users.filter((u) => u.id !== excludeUserId);
}

function activeLabLeaders(excludeUserId?: string) {
  return activeUsers(["LAB_LEADER"], excludeUserId);
}

// In-app notification plus email to each recipient.
async function notifyMany(
  recipients: { id: string; email: string }[],
  caseId: string,
  subject: string,
  message: string
) {
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((r) => ({ userId: r.id, caseId, message })),
  });
  sendEmail(
    recipients.map((r) => r.email),
    subject,
    message,
    caseUrl(caseId)
  );
}

export async function notifyDesignerAssigned(caseId: string, designerId: string, patientName: string) {
  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: { email: true },
  });

  const message = `You were assigned a new case: ${patientName}`;
  await prisma.notification.create({ data: { userId: designerId, caseId, message } });

  if (designer) sendEmail(designer.email, `New case assigned: ${patientName}`, message, caseUrl(caseId));
}

// `actorId` is the person who made the assignment; they don't need to be told.
export async function notifyLabLeadersAssigned(
  caseId: string,
  patientName: string,
  designerId: string,
  actorId: string
) {
  const [leaders, designer] = await Promise.all([
    activeLabLeaders(actorId),
    prisma.user.findUnique({ where: { id: designerId }, select: { name: true } }),
  ]);
  if (leaders.length === 0) return;

  const message = `Case ${patientName} was assigned to ${designer?.name ?? "a designer"}`;
  await prisma.notification.createMany({
    data: leaders.map((l) => ({ userId: l.id, caseId, message })),
  });

  sendEmail(
    leaders.map((l) => l.email),
    `Case assigned: ${patientName}`,
    message,
    caseUrl(caseId)
  );
}

export async function notifyLabLeadersReviewReady(
  caseId: string,
  patientName: string,
  stage?: string
) {
  const leaders = await activeLabLeaders();
  if (leaders.length === 0) return;

  const message = `Case ready for review: ${patientName}${stage ? ` (${stage})` : ""}`;
  await prisma.notification.createMany({
    data: leaders.map((l) => ({ userId: l.id, caseId, message })),
  });

  sendEmail(
    leaders.map((l) => l.email),
    `Ready for review: ${patientName}`,
    message,
    caseUrl(caseId)
  );
}

export async function notifyPhotogrammetryNeeded(caseId: string, patientName: string) {
  await notifyMany(
    await activeUsers(["PHOTOGRAMMETRY"]),
    caseId,
    `Photogrammetry needed: ${patientName}`,
    `Case ${patientName} needs photogrammetry`
  );
}

export async function notifyPhotogrammetryDone(caseId: string, patientName: string, actorId: string) {
  await notifyMany(
    await activeLabLeaders(actorId),
    caseId,
    `Photogrammetry done: ${patientName}`,
    `Photogrammetry is done for case ${patientName}`
  );
}

export async function notifyDesignerIbarDone(caseId: string, designerId: string, patientName: string) {
  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: { id: true, email: true },
  });
  if (!designer) return;
  await notifyMany(
    [designer],
    caseId,
    `Ready for you to design: ${patientName}`,
    `The ibar is done for case ${patientName}; it's ready for you to design`
  );
}

// Technicians and Lab Leaders move cases out of matching.
export async function notifyMatchingReady(caseId: string, patientName: string, matchingBy: string) {
  await notifyMany(
    await activeUsers(["LAB_LEADER", "TECHNICIAN"]),
    caseId,
    `Ready for matching: ${patientName}`,
    `Design submitted for case ${patientName}; it's now with ${matchingBy} for matching`
  );
}

export async function notifyLabLeadersMatchingDone(caseId: string, patientName: string, actorId: string) {
  await notifyMany(
    await activeLabLeaders(actorId),
    caseId,
    `Ready for review: ${patientName}`,
    `Matching is done; case ready for review: ${patientName}`
  );
}
