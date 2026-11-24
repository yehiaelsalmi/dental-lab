"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireVisibleCase } from "@/lib/access";
import { notifyLowStock } from "@/lib/notifications";
import { isLow, nextItemCode, normalizeCode } from "@/lib/inventory";

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

function perBlock(formData: FormData): number | null {
  const n = Number(String(formData.get("unitsPerBlock") ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function details(formData: FormData) {
  return {
    unitsPerBlock: perBlock(formData),
    type: text(formData, "type"),
    colour: text(formData, "colour"),
    size: text(formData, "size"),
    scalingFactor: text(formData, "scalingFactor", 40),
    notes: text(formData, "notes", 500),
  };
}

// Tells the inventory people once an item drops to its minimum.
async function warnIfNowLow(
  before: { quantity: number; minQuantity: number | null },
  after: { id: string; name: string; quantity: number; minQuantity: number | null },
  actorId: string
) {
  if (isLow(after) && !isLow(before)) await notifyLowStock(after, actorId);
}

export async function createItem(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const back = "/inventory";
  const name = text(formData, "name");
  if (!name) redirect(`${back}?error=${encodeURIComponent("Give the item a name.")}`);
  // For block items both are entered in blocks and stored in units.
  const per = perBlock(formData) ?? 1;
  const quantity = (count(formData, "quantity", "the quantity", back) ?? 0) * per;
  const min = count(formData, "minQuantity", "the minimum", back, true);
  const item = await prisma.inventoryItem.create({
    data: {
      name: name!,
      ...details(formData),
      code: await nextItemCode(),
      quantity,
      minQuantity: min == null ? null : min * per,
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
  const quantity = count(formData, "quantity", "the quantity", back)!;
  const min = count(formData, "minQuantity", "the minimum", back, true);
  const minQuantity = min == null ? null : min * (perBlock(formData) ?? 1);
  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: name!,
      ...details(formData),
      quantity,
      minQuantity,
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
  await warnIfNowLow(item!, updated, session.userId);
  revalidatePath("/inventory");
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

// Stock that came in.
export async function receiveStock(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const id = String(formData.get("id"));
  const back = `/inventory/${id}`;
  const entered = count(formData, "amount", "how many came in", back)!;
  if (entered === 0) redirect(`${back}?error=${encodeURIComponent("Enter how many came in.")}`);
  // Block items come in whole blocks.
  const current = await prisma.inventoryItem.findUnique({ where: { id }, select: { unitsPerBlock: true } });
  const amount = entered * (current?.unitsPerBlock ?? 1);
  const updated = await prisma.inventoryItem.update({ where: { id }, data: { quantity: { increment: amount } } });
  await prisma.inventoryMovement.create({
    data: { itemId: id, kind: "RECEIVED", change: amount, quantityAfter: updated.quantity, note: text(formData, "note", 200), createdById: session.userId },
  });
  revalidatePath("/inventory");
  revalidatePath(back);
  redirect(`${back}?received=${entered}`);
}

export async function deleteItem(formData: FormData) {
  await requirePermission("page.inventory");
  await prisma.inventoryItem.deleteMany({ where: { id: String(formData.get("id")) } });
  revalidatePath("/inventory");
  redirect("/inventory?deleted=1");
}

// Material taken from stock for a case (e.g. by the milling person). The
// item is picked from the list or by scanning its QR label.
export async function useForCase(formData: FormData) {
  const session = await requirePermission("inventory.use");
  const caseId = String(formData.get("caseId"));
  const back = `/cases/${caseId}`;
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  await requireVisibleCase(session, caseId);

  const scanned = String(formData.get("code") ?? "").trim();
  const item = scanned
    ? await prisma.inventoryItem.findUnique({ where: { code: normalizeCode(scanned) } })
    : await prisma.inventoryItem.findUnique({ where: { id: String(formData.get("itemId") ?? "") } });
  if (!item) fail(scanned ? `No item has the code ${normalizeCode(scanned)}.` : "Pick the material.");
  const qty = Number(formData.get("quantity"));
  if (!Number.isInteger(qty) || qty < 1) fail("Enter how many units you used (1 or more).");

  // Only take it if there's enough left (checked and taken in one step).
  const taken = await prisma.inventoryItem.updateMany({
    where: { id: item!.id, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });
  if (taken.count === 0) fail(`Only ${item!.quantity} ${item!.unitsPerBlock ? "units" : ""} of ${item!.name} left in stock.`);
  let updated = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item!.id } });
  await prisma.inventoryMovement.create({
    data: {
      itemId: item!.id,
      kind: "USED",
      change: -qty,
      quantityAfter: updated.quantity,
      caseId,
      note: text(formData, "note", 200),
      createdById: session.userId,
    },
  });
  // Block finished: what was left of it is no longer usable.
  const per = updated.unitsPerBlock;
  const leftInBlock = per ? updated.quantity % per : 0;
  if (formData.get("blockDone") === "on" && leftInBlock > 0) {
    updated = await prisma.inventoryItem.update({ where: { id: item!.id }, data: { quantity: { decrement: leftInBlock } } });
    await prisma.inventoryMovement.create({
      data: {
        itemId: item!.id,
        kind: "BLOCK_DONE",
        change: -leftInBlock,
        quantityAfter: updated.quantity,
        caseId,
        note: "Rest of the block (finished)",
        createdById: session.userId,
      },
    });
  }
  await warnIfNowLow(item!, updated, session.userId);
  revalidatePath(back);
  revalidatePath("/inventory");
  redirect(`${back}?used=1`);
}

// Undo a use entered by mistake: the quantity goes back into stock.
export async function undoUse(formData: FormData) {
  const session = await requirePermission("inventory.use");
  const caseId = String(formData.get("caseId"));
  await requireVisibleCase(session, caseId);
  const use = await prisma.inventoryMovement.findFirst({
    where: { id: String(formData.get("movementId")), caseId, kind: "USED" },
  });
  if (use) {
    // A "block finished" entered with it (seconds later) is undone too.
    const done = await prisma.inventoryMovement.findFirst({
      where: {
        itemId: use.itemId,
        caseId,
        kind: "BLOCK_DONE",
        createdAt: { gte: use.createdAt, lte: new Date(use.createdAt.getTime() + 10_000) },
      },
    });
    const back = -use.change - (done?.change ?? 0);
    await prisma.inventoryItem.update({ where: { id: use.itemId }, data: { quantity: { increment: back } } });
    await prisma.inventoryMovement.deleteMany({ where: { id: { in: [use.id, ...(done ? [done.id] : [])] } } });
  }
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/inventory");
  redirect(`/cases/${caseId}`);
}
