import { prisma } from "@/lib/prisma";
import { caseUrl, sendEmail } from "@/lib/email";

async function activeLabLeaders(excludeUserId?: string) {
  const leaders = await prisma.user.findMany({
    where: { role: "LAB_LEADER", active: true },
    select: { id: true, email: true },
  });
  return leaders.filter((l) => l.id !== excludeUserId);
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

export async function notifyLabLeadersReviewReady(caseId: string, patientName: string) {
  const leaders = await activeLabLeaders();
  if (leaders.length === 0) return;

  const message = `Case ready for review: ${patientName}`;
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
