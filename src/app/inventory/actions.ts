"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireVisibleCase } from "@/lib/access";
import { notifyLowStock } from "@/lib/notifications";
import { blockLabel, createBlocks, isLow, nextItemCode, normalizeCode, recomputeQuantity } from "@/lib/inventory";

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

// Price per block / piece; empty means none. Bad input sends the user back.
function price(formData: FormData, back: string): number | null {
  const raw = String(formData.get("price") ?? "").trim().replace(/,/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) redirect(`${back}?error=${encodeURIComponent("Enter the price as a number (0 or more).")}`);
  return n;
}

function details(formData: FormData) {
  return {
    type: text(formData, "type"),
    colour: text(formData, "colour"),
    size: text(formData, "size"),
    scalingFactor: text(formData, "scalingFactor", 40),
    notes: text(formData, "notes", 500),
  };
}

type Stock = { id: string; name: string; quantity: number; minQuantity: number | null; trackBlocks: boolean };

// Tells the inventory people once an item drops to its minimum.
async function warnIfNowLow(before: Stock, after: Stock, actorId: string) {
  if (isLow(after) && !isLow(before)) await notifyLowStock(after, actorId);
}

const blocksQuery = (blocks: { id: string }[]) => (blocks.length ? `&blocks=${blocks.map((b) => b.id).join(",")}` : "");

export async function createItem(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const back = "/inventory";
  const name = text(formData, "name");
  if (!name) redirect(`${back}?error=${encodeURIComponent("Give the item a name.")}`);
  const trackBlocks = formData.get("trackBlocks") === "on";
  const quantity = count(formData, "quantity", "the quantity", back) ?? 0;
  const item = await prisma.inventoryItem.create({
    data: {
      name: name!,
      ...details(formData),
      price: price(formData, back),
      trackBlocks,
      code: await nextItemCode(),
      quantity,
      minQuantity: count(formData, "minQuantity", "the minimum", back, true),
      movements: quantity
        ? { create: { kind: "RECEIVED", change: quantity, quantityAfter: quantity, note: "Starting stock", createdById: session.userId } }
        : undefined,
    },
  });
  const blocks = trackBlocks && quantity ? await createBlocks(item.id, quantity) : [];
  revalidatePath("/inventory");
  redirect(`/inventory/${item.id}?created=1${blocksQuery(blocks)}`);
}

export async function updateItem(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const id = String(formData.get("id"));
  const back = `/inventory/${id}`;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) redirect("/inventory");
  const name = text(formData, "name");
  if (!name) redirect(`${back}?error=${encodeURIComponent("Give the item a name.")}`);
  const trackBlocks = formData.get("trackBlocks") === "on";
  // Block items' stock comes from their blocks; pieces can be corrected here.
  const quantity = trackBlocks ? item!.quantity : count(formData, "quantity", "the quantity", back)!;
  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: name!,
      ...details(formData),
      price: price(formData, back),
      trackBlocks,
      quantity,
      minQuantity: count(formData, "minQuantity", "the minimum", back, true),
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
  // Switched to blocks: the pieces already in stock become labelled blocks.
  let blocks: { id: string }[] = [];
  if (trackBlocks && !item!.trackBlocks) {
    const existing = await prisma.inventoryBlock.count({ where: { itemId: id, finishedAt: null } });
    if (existing === 0 && item!.quantity > 0) blocks = await createBlocks(id, item!.quantity);
    await recomputeQuantity(id);
  }
  await warnIfNowLow(item!, updated, session.userId);
  revalidatePath("/inventory");
  revalidatePath(back);
  redirect(`${back}?saved=1${blocksQuery(blocks)}`);
}

// Stock that came in; block items get one new labelled block per block.
export async function receiveStock(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const id = String(formData.get("id"));
  const back = `/inventory/${id}`;
  const amount = count(formData, "amount", "how many came in", back)!;
  if (amount === 0) redirect(`${back}?error=${encodeURIComponent("Enter how many came in.")}`);
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) redirect("/inventory");
  let blocks: { id: string }[] = [];
  let updated;
  if (item!.trackBlocks) {
    blocks = await createBlocks(id, amount);
    updated = await recomputeQuantity(id);
  } else {
    updated = await prisma.inventoryItem.update({ where: { id }, data: { quantity: { increment: amount } } });
  }
  await prisma.inventoryMovement.create({
    data: { itemId: id, kind: "RECEIVED", change: amount, quantityAfter: updated.quantity, note: text(formData, "note", 200), createdById: session.userId },
  });
  revalidatePath("/inventory");
  revalidatePath(back);
  redirect(`${back}?received=${amount}${blocksQuery(blocks)}`);
}

export async function deleteItem(formData: FormData) {
  await requirePermission("page.inventory");
  await prisma.inventoryItem.deleteMany({ where: { id: String(formData.get("id")) } });
  revalidatePath("/inventory");
  redirect("/inventory?deleted=1");
}

// The lab leader names a block anything (empty puts the code back).
export async function renameBlock(formData: FormData) {
  await requirePermission("page.inventory");
  const block = await prisma.inventoryBlock.findUnique({ where: { id: String(formData.get("blockId")) } });
  if (!block) redirect("/inventory");
  await prisma.inventoryBlock.update({ where: { id: block!.id }, data: { name: text(formData, "name", 80) } });
  revalidatePath(`/inventory/${block!.itemId}`);
  redirect(`/inventory/${block!.itemId}?renamed=1`);
}

// Finishes a block by hand (e.g. broken), or opens a finished one again.
export async function toggleBlockFinished(formData: FormData) {
  const session = await requirePermission("page.inventory");
  const block = await prisma.inventoryBlock.findUnique({ where: { id: String(formData.get("blockId")) }, include: { item: true } });
  if (!block) redirect("/inventory");
  const finishing = !block!.finishedAt;
  await prisma.inventoryBlock.update({ where: { id: block!.id }, data: { finishedAt: finishing ? new Date() : null } });
  const updated = await recomputeQuantity(block!.itemId);
  await prisma.inventoryMovement.create({
    data: {
      itemId: block!.itemId,
      blockId: block!.id,
      kind: finishing ? "BLOCK_DONE" : "CORRECTION",
      change: finishing ? -1 : 1,
      quantityAfter: updated.quantity,
      note: finishing ? text(formData, "note", 200) ?? "Finished by hand" : "Opened again",
      createdById: session.userId,
    },
  });
  await warnIfNowLow(block!.item, updated, session.userId);
  revalidatePath(`/inventory/${block!.itemId}`);
  revalidatePath("/inventory");
  redirect(`/inventory/${block!.itemId}`);
}

// Material used for a case (e.g. by the milling person). Blocks: the block
// scanned or picked, with the units milled from it (the miller decides);
// "finished the block" takes it out of stock. Pieces: the count used.
export async function useForCase(formData: FormData) {
  const session = await requirePermission("inventory.use");
  const caseId = String(formData.get("caseId"));
  const back = `/cases/${caseId}`;
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  await requireVisibleCase(session, caseId);

  // What was scanned or picked: a block, or an item counted in pieces.
  const scanned = normalizeCode(String(formData.get("code") ?? ""));
  const picked = String(formData.get("pick") ?? "");
  let block = null;
  let item = null;
  if (scanned.startsWith("BLK") || picked.startsWith("block:")) {
    block = await prisma.inventoryBlock.findUnique({
      where: scanned.startsWith("BLK") ? { code: scanned } : { id: picked.slice(6) },
      include: { item: true },
    });
    if (!block) fail(`No block has the code ${scanned}.`);
    if (block!.finishedAt) fail(`Block ${blockLabel(block!)} is already finished.`);
    item = block!.item;
  } else if (scanned) {
    item = await prisma.inventoryItem.findUnique({ where: { code: scanned } });
    if (!item) fail(`No item has the code ${scanned}.`);
    if (item!.trackBlocks) fail(`Scan the label on the block you milled from (not the ${item!.name} item label).`);
  } else if (picked.startsWith("item:")) {
    item = await prisma.inventoryItem.findUnique({ where: { id: picked.slice(5) } });
  }
  if (!item) fail("Pick the material, or scan its label.");

  const qty = Number(formData.get("quantity"));
  if (!Number.isInteger(qty) || qty < 1) fail(block ? "Enter how many units you milled (1 or more)." : "Enter how many you used (1 or more).");
  const note = text(formData, "note", 200);

  if (block) {
    await prisma.inventoryBlock.update({ where: { id: block.id }, data: { unitsMilled: { increment: qty } } });
    await prisma.inventoryMovement.create({
      data: { itemId: item!.id, blockId: block.id, kind: "USED", change: 0, units: qty, quantityAfter: item!.quantity, caseId, note, createdById: session.userId },
    });
    if (formData.get("blockDone") === "on") {
      await prisma.inventoryBlock.update({ where: { id: block.id }, data: { finishedAt: new Date() } });
      const updated = await recomputeQuantity(item!.id);
      await prisma.inventoryMovement.create({
        data: { itemId: item!.id, blockId: block.id, kind: "BLOCK_DONE", change: -1, quantityAfter: updated.quantity, caseId, createdById: session.userId },
      });
      await warnIfNowLow(item!, updated, session.userId);
    }
  } else {
    // Only take pieces if there are enough left (checked and taken in one step).
    const taken = await prisma.inventoryItem.updateMany({ where: { id: item!.id, quantity: { gte: qty } }, data: { quantity: { decrement: qty } } });
    if (taken.count === 0) fail(`Only ${item!.quantity} of ${item!.name} left in stock.`);
    const updated = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item!.id } });
    await prisma.inventoryMovement.create({
      data: { itemId: item!.id, kind: "USED", change: -qty, quantityAfter: updated.quantity, caseId, note, createdById: session.userId },
    });
    await warnIfNowLow(item!, updated, session.userId);
  }
  revalidatePath(back);
  revalidatePath("/inventory");
  redirect(`${back}?used=1`);
}

// Undo a use entered by mistake (and the block finish entered with it).
export async function undoUse(formData: FormData) {
  const session = await requirePermission("inventory.use");
  const caseId = String(formData.get("caseId"));
  await requireVisibleCase(session, caseId);
  const use = await prisma.inventoryMovement.findFirst({ where: { id: String(formData.get("movementId")), caseId, kind: "USED" } });
  if (use) {
    if (use.blockId) {
      const done = await prisma.inventoryMovement.findFirst({
        where: { blockId: use.blockId, caseId, kind: "BLOCK_DONE", createdAt: { gte: use.createdAt, lte: new Date(use.createdAt.getTime() + 10_000) } },
      });
      await prisma.inventoryBlock.update({
        where: { id: use.blockId },
        data: { unitsMilled: { decrement: use.units ?? 0 }, ...(done ? { finishedAt: null } : {}) },
      });
      await prisma.inventoryMovement.deleteMany({ where: { id: { in: [use.id, ...(done ? [done.id] : [])] } } });
      await recomputeQuantity(use.itemId);
    } else {
      await prisma.inventoryItem.update({ where: { id: use.itemId }, data: { quantity: { increment: -use.change } } });
      await prisma.inventoryMovement.delete({ where: { id: use.id } });
    }
  }
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/inventory");
  redirect(`/cases/${caseId}`);
}
