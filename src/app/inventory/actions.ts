"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { notifyLowStock } from "@/lib/notifications";
import { parseScannedCode } from "@/lib/udi";

// A scanned or typed code is stored as the product part (the same on every
// box of the product); the maker's REF is kept too.
function productCode(formData: FormData) {
  const raw = String(formData.get("code") ?? "").trim().slice(0, 300);
  if (!raw) return { code: null, ref: null };
  const parsed = parseScannedCode(raw);
  return { code: parsed.productKey, ref: parsed.ref ?? null };
}

// Lot / dates read from the box (hidden fields filled from the scan).
function batch(formData: FormData) {
  const date = (key: string) => {
    const v = String(formData.get(key) ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
  };
  return {
    lot: String(formData.get("lot") ?? "").trim().slice(0, 80) || null,
    expiresAt: date("expires"),
    madeAt: date("made"),
  };
}

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
  const { code, ref } = productCode(formData);
  if (await codeTaken(code)) redirect(`${back}?error=${encodeURIComponent("Another item already has that code.")}`);
  const quantity = count(formData, "quantity", "the quantity", back) ?? 0;
  const item = await prisma.inventoryItem.create({
    data: {
      name: name!,
      type: text(formData, "type"),
      colour: text(formData, "colour"),
      size: text(formData, "size"),
      code,
      ref,
      quantity,
      minQuantity: count(formData, "minQuantity", "the minimum", back, true),
      notes: text(formData, "notes", 500),
      movements: quantity
        ? {
            create: {
              kind: "RECEIVED",
              change: quantity,
              quantityAfter: quantity,
              note: "Starting stock",
              ...batch(formData),
              createdById: session.userId,
            },
          }
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
  const { code, ref } = productCode(formData);
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
      ref: code === item!.code ? item!.ref : ref,
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
      ...batch(formData),
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
