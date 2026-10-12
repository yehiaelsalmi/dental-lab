"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import {
  BUILT_IN_LABEL_PREFIX,
  STATUS_COLOR_KEYS,
  STATUS_HIDDEN_KEY,
  STATUS_ORDER_KEY,
  cannotHide,
  getAllStatuses,
  getStatuses,
  hiddenStatuses,
  isBuiltInStatus,
} from "@/lib/statuses";
import { getSetting, setSetting } from "@/lib/settings";

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

  const statuses = await getAllStatuses();
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
  if (data.afterStatus !== status.afterStatus) {
    const order = (await getAllStatuses()).map((s) => s.key).filter((k) => k !== status.key);
    if (await getSetting(STATUS_ORDER_KEY)) await setSetting(STATUS_ORDER_KEY, JSON.stringify(order));
  }
  revalidatePath("/settings/statuses");
  back("saved=1");
}

// Cases still in a status that's being deleted or hidden move to `moveTo`.
async function moveCasesOut(key: string, label: string, moveTo: string) {
  const inUse = await prisma.case.count({ where: { status: key } });
  if (inUse === 0) return;
  const target = (await getStatuses()).find((s) => s.key === moveTo && s.key !== key);
  if (!target) {
    fail(`${inUse} case${inUse === 1 ? " is" : "s are"} in "${label}". Pick the status to move ${inUse === 1 ? "it" : "them"} to.`);
  }
  await prisma.case.updateMany({ where: { status: key }, data: { status: target.key } });
}

// Statuses listed after it move up to take its place.
export async function deleteStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const id = String(formData.get("id"));
  const status = await prisma.customStatus.findUnique({ where: { id } });
  if (!status || isBuiltInStatus(status.key)) back("");

  await moveCasesOut(status.key, status.label, String(formData.get("moveTo") ?? ""));
  await prisma.checklistTemplateItem.deleteMany({ where: { status: status.key } });

  await prisma.customStatus.updateMany({
    where: { afterStatus: status.key },
    data: { afterStatus: status.afterStatus },
  });
  await prisma.customStatus.delete({ where: { id } });
  revalidatePath("/", "layout");
  back(`deleted=${encodeURIComponent(status.label)}`);
}

// Built-in statuses keep their place and behaviour; only the name changes.
export async function renameBuiltInStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const key = String(formData.get("key"));
  const label = String(formData.get("label") ?? "").trim();
  if (!isBuiltInStatus(key)) back("");
  if (!label) fail("Give the status a name.");
  if (label.length > 40) fail("Keep the name under 40 characters.");
  const statuses = await getStatuses();
  if (statuses.some((s) => s.key !== key && s.label.toLowerCase() === label.toLowerCase())) {
    fail(`There is already a status called ${label}.`);
  }
  await setSetting(BUILT_IN_LABEL_PREFIX + key, label);
  revalidatePath("/", "layout");
  back("saved=1");
}

// Moves a status one place up or down in the display order. The workflow
// buttons don't change.
export async function moveStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const key = String(formData.get("key"));
  const keys = (await getAllStatuses()).map((s) => s.key);
  const at = keys.indexOf(key);
  const other = formData.get("direction") === "up" ? at - 1 : at + 1;
  if (at !== -1 && other >= 0 && other < keys.length) {
    [keys[at], keys[other]] = [keys[other], keys[at]];
    await setSetting(STATUS_ORDER_KEY, JSON.stringify(keys));
  }
  revalidatePath("/", "layout");
  back("");
}

// Hides a built-in status: it leaves every list and the workflow skips it.
export async function hideStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const key = String(formData.get("key"));
  if (!isBuiltInStatus(key)) back("");
  const hidden = await hiddenStatuses();
  const reason = cannotHide(key, hidden);
  if (reason) fail(reason);
  const label = (await getAllStatuses()).find((s) => s.key === key)?.label ?? key;
  await moveCasesOut(key, label, String(formData.get("moveTo") ?? ""));
  await setSetting(STATUS_HIDDEN_KEY, JSON.stringify([...hidden, key]));
  revalidatePath("/", "layout");
  back(`hidden=${encodeURIComponent(label)}`);
}

export async function showStatus(formData: FormData) {
  await requirePermission("page.statuses");
  const key = String(formData.get("key"));
  const hidden = [...(await hiddenStatuses())].filter((k) => k !== key);
  await setSetting(STATUS_HIDDEN_KEY, JSON.stringify(hidden));
  revalidatePath("/", "layout");
  back("saved=1");
}
