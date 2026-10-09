"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { getStatuses } from "@/lib/statuses";

function back(status: string, params = ""): never {
  redirect(`/settings/checklists?status=${encodeURIComponent(status)}${params ? `&${params}` : ""}`);
}

export async function addChecklistTemplateItem(formData: FormData) {
  await requirePermission("page.checklists");
  const status = String(formData.get("status") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!(await getStatuses()).some((s) => s.key === status)) back("", "error=Pick+a+status.");
  if (!text) back(status, "error=Write+the+item+first.");
  const last = await prisma.checklistTemplateItem.findFirst({ where: { status }, orderBy: { position: "desc" } });
  await prisma.checklistTemplateItem.create({
    data: { status, text: text.slice(0, 200), position: (last?.position ?? -1) + 1 },
  });
  revalidatePath("/", "layout");
  back(status);
}

export async function updateChecklistTemplateItem(formData: FormData) {
  await requirePermission("page.checklists");
  const id = String(formData.get("id"));
  const text = String(formData.get("text") ?? "").trim();
  const item = await prisma.checklistTemplateItem.findUnique({ where: { id } });
  if (!item) back("");
  if (!text) back(item.status, "error=The+item+can%27t+be+empty.");
  await prisma.checklistTemplateItem.update({ where: { id }, data: { text: text.slice(0, 200) } });
  revalidatePath("/", "layout");
  back(item.status);
}

// Removing an item also removes its ticks on every case.
export async function deleteChecklistTemplateItem(formData: FormData) {
  await requirePermission("page.checklists");
  const id = String(formData.get("id"));
  const item = await prisma.checklistTemplateItem.findUnique({ where: { id } });
  if (!item) back("");
  await prisma.checklistTemplateItem.delete({ where: { id } });
  revalidatePath("/", "layout");
  back(item.status);
}

// Swaps an item with its neighbour above ("up") or below ("down").
export async function moveChecklistTemplateItem(formData: FormData) {
  await requirePermission("page.checklists");
  const id = String(formData.get("id"));
  const direction = formData.get("direction") === "up" ? "up" : "down";
  const item = await prisma.checklistTemplateItem.findUnique({ where: { id } });
  if (!item) back("");
  const items = await prisma.checklistTemplateItem.findMany({
    where: { status: item.status },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const at = items.findIndex((i) => i.id === id);
  const other = direction === "up" ? at - 1 : at + 1;
  if (other >= 0 && other < items.length) {
    [items[at], items[other]] = [items[other], items[at]];
    await prisma.$transaction(
      items.map((i, position) => prisma.checklistTemplateItem.update({ where: { id: i.id }, data: { position } }))
    );
  }
  revalidatePath("/", "layout");
  back(item.status);
}
