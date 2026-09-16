import { prisma } from "@/lib/prisma";

export async function notifyDesignerAssigned(caseId: string, designerId: string, patientName: string) {
  await prisma.notification.create({
    data: {
      userId: designerId,
      caseId,
      message: `You were assigned a new case: ${patientName}`,
    },
  });
}

export async function notifyLabLeadersReviewReady(caseId: string, patientName: string) {
  const leaders = await prisma.user.findMany({
    where: { role: "LAB_LEADER", active: true },
    select: { id: true },
  });

  if (leaders.length === 0) return;

  await prisma.notification.createMany({
    data: leaders.map((leader) => ({
      userId: leader.id,
      caseId,
      message: `Case ready for review: ${patientName}`,
    })),
  });
}
