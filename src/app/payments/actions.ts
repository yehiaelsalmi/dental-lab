"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { STAFF_PAYMENT_KINDS, parsePaidAt } from "@/lib/payments";

function readPayment(formData: FormData, back: string) {
  const fail = (message: string): never => redirect(`${back}?error=${encodeURIComponent(message)}`);
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) fail("Enter an amount above zero.");
  const paidAt = parsePaidAt(formData.get("paidAt"));
  if (!paidAt) fail("Pick the payment date.");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  return { amount, paidAt: paidAt as Date, note };
}

export async function addDoctorPayment(formData: FormData) {
  const access = await requirePermission("money.payments");
  const doctorId = String(formData.get("doctorId"));
  const back = `/payments/doctors/${doctorId}`;
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) redirect("/payments");
  await prisma.doctorPayment.create({
    data: { doctorId, ...readPayment(formData, back), createdById: access.userId },
  });
  revalidatePath("/payments", "layout");
  redirect(`${back}?saved=1`);
}

export async function deleteDoctorPayment(formData: FormData) {
  await requirePermission("money.payments");
  const payment = await prisma.doctorPayment.findUnique({ where: { id: String(formData.get("id")) } });
  if (!payment) redirect("/payments");
  await prisma.doctorPayment.delete({ where: { id: payment.id } });
  revalidatePath("/payments", "layout");
  redirect(`/payments/doctors/${payment.doctorId}?deleted=1`);
}

export async function addStaffPayment(formData: FormData) {
  const access = await requirePermission("money.payments");
  const userId = String(formData.get("userId"));
  const back = `/payments/team/${userId}`;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/payments?tab=team");
  const kind = String(formData.get("kind"));
  if (!Object.hasOwn(STAFF_PAYMENT_KINDS, kind)) redirect(`${back}?error=${encodeURIComponent("Pick what the payment is for.")}`);
  await prisma.staffPayment.create({
    data: { userId, kind, ...readPayment(formData, back), createdById: access.userId },
  });
  revalidatePath("/payments", "layout");
  redirect(`${back}?saved=1`);
}

export async function deleteStaffPayment(formData: FormData) {
  await requirePermission("money.payments");
  const payment = await prisma.staffPayment.findUnique({ where: { id: String(formData.get("id")) } });
  if (!payment) redirect("/payments?tab=team");
  await prisma.staffPayment.delete({ where: { id: payment.id } });
  revalidatePath("/payments", "layout");
  redirect(`/payments/team/${payment.userId}?deleted=1`);
}
