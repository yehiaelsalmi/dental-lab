"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { isMonthKey, monthStart } from "@/lib/overheads";

function back(month: string, params = ""): never {
  redirect(`/expenses?month=${month}${params ? `&${params}` : ""}`);
}

function readAmount(formData: FormData, month: string): number {
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount < 0) back(month, `error=${encodeURIComponent("Enter a valid amount.")}`);
  return amount;
}

export async function addExpense(formData: FormData) {
  await requirePermission("page.expenses");
  const month = String(formData.get("month"));
  if (!isMonthKey(month)) redirect("/expenses");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back(month, `error=${encodeURIComponent("Give the expense a name.")}`);

  await prisma.expense.create({
    data: {
      name,
      amount: readAmount(formData, month),
      month: monthStart(month),
      recurring: formData.get("recurring") === "on",
    },
  });
  revalidatePath("/expenses");
  back(month, "saved=1");
}

// Changing a recurring expense changes it for every month it covers.
export async function updateExpense(formData: FormData) {
  await requirePermission("page.expenses");
  const month = String(formData.get("month"));
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back(month, `error=${encodeURIComponent("Give the expense a name.")}`);
  await prisma.expense.update({ where: { id }, data: { name, amount: readAmount(formData, month) } });
  revalidatePath("/expenses");
  back(month, "saved=1");
}

// A recurring expense stops after the month being viewed; earlier months keep it.
export async function stopExpense(formData: FormData) {
  await requirePermission("page.expenses");
  const month = String(formData.get("month"));
  if (!isMonthKey(month)) redirect("/expenses");
  await prisma.expense.update({ where: { id: String(formData.get("id")) }, data: { endMonth: monthStart(month) } });
  revalidatePath("/expenses");
  back(month, "saved=1");
}

export async function deleteExpense(formData: FormData) {
  await requirePermission("page.expenses");
  const month = String(formData.get("month"));
  await prisma.expense.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/expenses");
  back(month, "saved=1");
}
