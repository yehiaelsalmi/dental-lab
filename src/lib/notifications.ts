import { prisma } from "@/lib/prisma";
import { caseUrl, sendEmail } from "@/lib/email";
import { CASE_STATUS_LABELS, type CaseStatus } from "@/lib/constants";
import { PHOTOGRAMMETRY_NEEDED, type Permission } from "@/lib/permissions";
import { canViewCase, toRoleAccess, usersWithPermission } from "@/lib/access";

type Recipient = { id: string; email: string };

async function holders(permission: Permission, excludeUserId?: string): Promise<Recipient[]> {
  return (await usersWithPermission(permission)).filter((u) => u.id !== excludeUserId);
}

// "Leaders" here means whoever can approve designs; they also hear about
// assignments and finished steps.
function reviewers(excludeUserId?: string) {
  return holders("case.review", excludeUserId);
}

// In-app notification plus email to each recipient.
async function notifyMany(recipients: Recipient[], caseId: string, subject: string, message: string) {
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

async function userRecipient(userId: string): Promise<Recipient[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  return user ? [user] : [];
}

// Users whose role is set to be notified on `event` and who can see the case.
async function watchers(caseId: string, event: string, excludeUserId?: string) {
  const [caseRecord, users] = await Promise.all([
    prisma.case.findUnique({ where: { id: caseId } }),
    prisma.user.findMany({ where: { active: true }, include: { role: true } }),
  ]);
  if (!caseRecord) return [];
  return users.filter((u) => {
    if (u.id === excludeUserId) return false;
    const role = toRoleAccess(u.role);
    if (!role.notifyOn.includes(event)) return false;
    return canViewCase(
      { userId: u.id, name: u.name, email: u.email, role },
      caseRecord
    );
  });
}

export async function notifyDesignerAssigned(caseId: string, designerId: string, patientName: string) {
  await notifyMany(
    await userRecipient(designerId),
    caseId,
    `New case assigned: ${patientName}`,
    `You were assigned a new case: ${patientName}`
  );
}

export async function notifyCeramistAssigned(caseId: string, ceramistId: string, patientName: string) {
  await notifyMany(
    await userRecipient(ceramistId),
    caseId,
    `Case assigned to you: ${patientName}`,
    `You were assigned as the ceramist for case ${patientName}`
  );
}

// `actorId` is the person who made the assignment; they don't need to be told.
export async function notifyLabLeadersAssigned(
  caseId: string,
  patientName: string,
  designerId: string,
  actorId: string
) {
  const designer = await prisma.user.findUnique({ where: { id: designerId }, select: { name: true } });
  await notifyMany(
    await reviewers(actorId),
    caseId,
    `Case assigned: ${patientName}`,
    `Case ${patientName} was assigned to ${designer?.name ?? "a designer"}`
  );
}

export async function notifyLabLeadersReviewReady(caseId: string, patientName: string, stage?: string) {
  await notifyMany(
    await reviewers(),
    caseId,
    `Ready for review: ${patientName}`,
    `Case ready for review: ${patientName}${stage ? ` (${stage})` : ""}`
  );
}

export async function notifyPhotogrammetryNeeded(caseId: string, patientName: string) {
  await notifyMany(
    await watchers(caseId, PHOTOGRAMMETRY_NEEDED),
    caseId,
    `Photogrammetry needed: ${patientName}`,
    `Case ${patientName} needs photogrammetry`
  );
}

export async function notifyPhotogrammetryDone(caseId: string, patientName: string, actorId: string) {
  await notifyMany(
    await reviewers(actorId),
    caseId,
    `Photogrammetry done: ${patientName}`,
    `Photogrammetry is done for case ${patientName}`
  );
}

export async function notifyDesignerIbarDone(caseId: string, designerId: string, patientName: string) {
  await notifyMany(
    await userRecipient(designerId),
    caseId,
    `Ready for you to design: ${patientName}`,
    `The ibar is done for case ${patientName}; it's ready for you to design`
  );
}

export async function notifyMatchingReady(caseId: string, patientName: string, matchingBy: string) {
  await notifyMany(
    await holders("case.matching"),
    caseId,
    `Ready for matching: ${patientName}`,
    `Design submitted for case ${patientName}; it's now with ${matchingBy} for matching`
  );
}

export async function notifyLabLeadersMatchingDone(caseId: string, patientName: string, actorId: string) {
  await notifyMany(
    await reviewers(actorId),
    caseId,
    `Ready for review: ${patientName}`,
    `Matching is done; case ready for review: ${patientName}`
  );
}

// Call after every status change: notifies roles the Lab Leader set to hear
// about this status (e.g. a Milling role when a case reaches Milling).
export async function notifyStatusWatchers(
  caseId: string,
  patientName: string,
  status: CaseStatus,
  actorId: string
) {
  const label = CASE_STATUS_LABELS[status];
  await notifyMany(
    await watchers(caseId, status, actorId),
    caseId,
    `${label}: ${patientName}`,
    `Case ${patientName} is now in ${label}`
  );
}
