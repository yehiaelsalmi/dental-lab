"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { notifyLowStock } from "@/lib/notifications";

function text(formData: FormData, key: string, max = 120): string | null {
  return String(formData.get(key) ?? "").trim().slice(0, max) || null;
}

function count(formData: FormData, key: string, label: string, back: string, optional = false): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "" && optional) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) redirect(`${back}?error=${encodeURIComponent(`Enter ${label} as a whole number (0 or more).`)}`);
  return n;
}

async function codeTaken(code: string | null, exceptId?: string) {
  if (!code) return false;
  const other = await prisma.inventoryItem.findUnique({ where: { code } });
  return !!other && other.id !== exceptId;
}

export async function createItem(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const back = "/inventory";
  const name = text(formData, "name");
  if (!name) redirect(`${back}?error=${encodeURIComponent("Give the item a name.")}`);
  const code = text(formData, "code", 200);
  if (await codeTaken(code)) redirect(`${back}?error=${encodeURIComponent("Another item already has that code.")}`);
  const quantity = count(formData, "quantity", "the quantity", back) ?? 0;
  const item = await prisma.inventoryItem.create({
    data: {
      name: name!,
      type: text(formData, "type"),
      colour: text(formData, "colour"),
      size: text(formData, "size"),
      code,
      quantity,
      minQuantity: count(formData, "minQuantity", "the minimum", back, true),
      notes: text(formData, "notes", 500),
      movements: quantity
        ? { create: { kind: "RECEIVED", change: quantity, quantityAfter: quantity, note: "Starting stock", createdById: session.userId } }
        : undefined,
    },
  });
  revalidatePath("/inventory");
  redirect(`/inventory/${item.id}?created=1`);
}

export async function updateItem(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const id = String(formData.get("id"));
  const back = `/inventory/${id}`;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) redirect("/inventory");
  const name = text(formData, "name");
  if (!name) redirect(`${back}?error=${encodeURIComponent("Give the item a name.")}`);
  const code = text(formData, "code", 200);
  if (await codeTaken(code, id)) redirect(`${back}?error=${encodeURIComponent("Another item already has that code.")}`);
  const quantity = count(formData, "quantity", "the quantity", back)!;
  const minQuantity = count(formData, "minQuantity", "the minimum", back, true);

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: name!,
      type: text(formData, "type"),
      colour: text(formData, "colour"),
      size: text(formData, "size"),
      code,
      quantity,
      minQuantity,
      notes: text(formData, "notes", 500),
      // A changed quantity is recorded as a correction.
      ...(quantity !== item!.quantity
        ? {
            movements: {
              create: {
                kind: "CORRECTION",
                change: quantity - item!.quantity,
                quantityAfter: quantity,
                note: text(formData, "correctionNote", 200),
                createdById: session.userId,
              },
            },
          }
        : {}),
    },
  });
  const wasLow = item!.minQuantity != null && item!.quantity <= item!.minQuantity;
  if (minQuantity != null && quantity <= minQuantity && !wasLow) {
    await notifyLowStock({ id, name: name!, quantity }, session.userId);
  }
  revalidatePath("/inventory");
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

// Stock that came in (e.g. right after scanning the box).
export async function receiveStock(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const id = String(formData.get("id"));
  const back = `/inventory/${id}`;
  const amount = count(formData, "amount", "how many came in", back)!;
  if (amount === 0) redirect(`${back}?error=${encodeURIComponent("Enter how many came in.")}`);
  const updated = await prisma.inventoryItem.update({ where: { id }, data: { quantity: { increment: amount } } });
  await prisma.inventoryMovement.create({
    data: {
      itemId: id,
      kind: "RECEIVED",
      change: amount,
      quantityAfter: updated.quantity,
      note: text(formData, "note", 200),
      createdById: session.userId,
    },
  });
  revalidatePath("/inventory");
  revalidatePath(back);
  redirect(`${back}?received=${amount}`);
}

export async function deleteItem(formData: FormData) {
  await requirePermission("page.inventory");
  const id = String(formData.get("id"));
  await prisma.inventoryItem.deleteMany({ where: { id } });
  revalidatePath("/inventory");
  redirect("/inventory?deleted=1");
}
