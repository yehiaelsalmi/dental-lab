"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { FIELD_TYPES } from "@/lib/customFields";

function back(params: string): never {
  redirect(`/settings/fields?${params}`);
}
function fail(message: string): never {
  back(`error=${encodeURIComponent(message)}`);
}

// Dropdown options: one per line, blanks and duplicates removed.
function readOptions(formData: FormData): string[] {
  return [
    ...new Set(
      String(formData.get("options") ?? "")
        .split(/\r?\n/)
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  ];
}

async function checkLabel(label: string, selfId?: string) {
  if (!label) fail("Give the field a name.");
  if (label.length > 60) fail("Keep the name under 60 characters.");
  const clash = await prisma.customField.findUnique({ where: { label } });
  if (clash && clash.id !== selfId) fail(`There is already a field called ${label}.`);
}

export async function createField(formData: FormData) {
  await requirePermission("page.fields");
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  await checkLabel(label);
  if (!FIELD_TYPES.some((t) => t.key === type)) fail("Pick a field type.");
  const options = readOptions(formData);
  if (type === "SELECT" && options.length < 2) fail("A dropdown needs at least 2 options (one per line).");

  const last = await prisma.customField.findFirst({ orderBy: { position: "desc" } });
  await prisma.customField.create({
    data: {
      label,
      type,
      options: JSON.stringify(type === "SELECT" ? options : []),
      required: formData.get("required") === "on",
      position: (last?.position ?? 0) + 1,
    },
  });
  revalidatePath("/settings/fields");
  back("saved=1");
}

// The type can't change once created (existing values might not fit it).
export async function updateField(formData: FormData) {
  await requirePermission("page.fields");
  const id = String(formData.get("id"));
  const field = await prisma.customField.findUnique({ where: { id } });
  if (!field) back("");
  const label = String(formData.get("label") ?? "").trim();
  await checkLabel(label, id);
  const options = readOptions(formData);
  if (field.type === "SELECT" && options.length < 2) fail("A dropdown needs at least 2 options (one per line).");

  await prisma.customField.update({
    where: { id },
    data: {
      label,
      required: formData.get("required") === "on",
      ...(field.type === "SELECT" ? { options: JSON.stringify(options) } : {}),
    },
  });
  revalidatePath("/settings/fields");
  back("saved=1");
}

export async function moveField(formData: FormData) {
  await requirePermission("page.fields");
  const id = String(formData.get("id"));
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const fields = await prisma.customField.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const index = fields.findIndex((f) => f.id === id);
  const swapWith = index + direction;
  if (index === -1 || swapWith < 0 || swapWith >= fields.length) back("");
  [fields[index], fields[swapWith]] = [fields[swapWith], fields[index]];
  await prisma.$transaction(
    fields.map((f, i) => prisma.customField.update({ where: { id: f.id }, data: { position: i + 1 } }))
  );
  revalidatePath("/settings/fields");
  back("");
}

// Archived fields leave the forms and reports but keep their saved values.
export async function toggleFieldArchived(formData: FormData) {
  await requirePermission("page.fields");
  const id = String(formData.get("id"));
  const field = await prisma.customField.findUnique({ where: { id } });
  if (!field) back("");
  await prisma.customField.update({ where: { id }, data: { archived: !field.archived } });
  revalidatePath("/settings/fields");
  back("saved=1");
}

// Only fields that were never filled in on any case can be deleted.
export async function deleteField(formData: FormData) {
  await requirePermission("page.fields");
  const id = String(formData.get("id"));
  const used = await prisma.caseFieldValue.count({ where: { fieldId: id } });
  if (used > 0) fail(`This field is filled in on ${used} case${used === 1 ? "" : "s"}. Archive it instead.`);
  await prisma.customField.delete({ where: { id } });
  revalidatePath("/settings/fields");
  back("saved=1");
}
