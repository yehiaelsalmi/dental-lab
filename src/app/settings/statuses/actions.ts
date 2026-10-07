"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { STATUS_COLOR_KEYS, getStatuses, isBuiltInStatus } from "@/lib/statuses";

function back(params: string): never {
  redirect(`/settings/statuses?${params}`);
}

function fail(message: string): never {
  back(`error=${encodeURIComponent(message)}`);
}

async function readForm(formData: FormData, selfKey?: string) {
  const label = String(formData.get("label") ?? "").trim();
  const color = String(formData.get("color") ?? "slate");
  const afterStatus = String(formData.get("afterStatus") ?? "");
  if (!label) fail("Give the status a name.");
  if (label.length > 40) fail("Keep the name under 40 characters.");
  if (!(STATUS_COLOR_KEYS as string[]).includes(color)) fail("Pick a colour.");

  const statuses = await getStatuses();
  if (!statuses.some((s) => s.key === afterStatus) || afterStatus === selfKey) {
    fail("Pick where the status goes.");
  }
  if (statuses.some((s) => s.key !== selfKey && s.label.toLowerCase() === label.toLowerCase())) {
    fail(`There is already a status called ${label}.`);
  }
  return { label, color, afterStatus };
}

export async function createStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const data = await readForm(formData);
  await prisma.customStatus.create({
    data: { ...data, key: `C_${randomBytes(6).toString("hex")}` },
  });
  revalidatePath("/settings/statuses");
  back("saved=1");
}

export async function updateStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const id = String(formData.get("id"));
  const status = await prisma.customStatus.findUnique({ where: { id } });
  if (!status) back("");
  const data = await readForm(formData, status.key);
  await prisma.customStatus.update({ where: { id }, data });
  revalidatePath("/settings/statuses");
  back("saved=1");
}

// Only statuses with no cases in them can be deleted. Statuses listed after it
// move up to take its place.
export async function deleteStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const id = String(formData.get("id"));
  const status = await prisma.customStatus.findUnique({ where: { id } });
  if (!status || isBuiltInStatus(status.key)) back("");

  const inUse = await prisma.case.count({ where: { status: status.key } });
  if (inUse > 0) {
    fail(`${inUse} case${inUse === 1 ? " is" : "s are"} in "${status.label}". Move ${inUse === 1 ? "it" : "them"} to another status first.`);
  }

  await prisma.customStatus.updateMany({
    where: { afterStatus: status.key },
    data: { afterStatus: status.afterStatus },
  });
  await prisma.customStatus.delete({ where: { id } });
  revalidatePath("/settings/statuses");
  back(`deleted=${encodeURIComponent(status.label)}`);
}
