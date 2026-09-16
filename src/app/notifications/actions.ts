"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function markAllNotificationsRead() {
  const session = await requireSession();

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/notifications");
}

export async function openNotification(formData: FormData) {
  const session = await requireSession();
  const notificationId = formData.get("notificationId") as string;

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== session.user.id) {
    redirect("/notifications");
  }

  await prisma.notification.update({ where: { id: notificationId }, data: { read: true } });

  redirect(notification.caseId ? `/cases/${notification.caseId}` : "/notifications");
}
