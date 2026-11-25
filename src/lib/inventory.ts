import { prisma } from "@/lib/prisma";
import { can, type Access } from "@/lib/access";

// Codes are the system's own: items "INV" + 5 digits, blocks "BLK" + 6
// digits. Letters and digits only, so scanners set to any keyboard layout
// type them correctly.
export async function nextItemCode(): Promise<string> {
  const codes = await prisma.inventoryItem.findMany({ where: { code: { startsWith: "INV" } }, select: { code: true } });
  const max = codes.reduce((m, c) => Math.max(m, Number(c.code?.slice(3)) || 0), 0);
  return `INV${String(max + 1).padStart(5, "0")}`;
}

// What a scanner typed: tolerate spaces, lower case, or a whole link.
export function normalizeCode(raw: string): string {
  const match = raw.toUpperCase().match(/(INV|BLK)\d{3,}/);
  return match ? match[0] : raw.trim().toUpperCase();
}

// Creates `count` new blocks of an item, each with its own code.
export async function createBlocks(itemId: string, count: number) {
  const codes = await prisma.inventoryBlock.findMany({ select: { code: true } });
  let n = codes.reduce((m, c) => Math.max(m, Number(c.code.slice(3)) || 0), 0);
  const blocks = [];
  for (let i = 0; i < count; i++) {
    n++;
    blocks.push(await prisma.inventoryBlock.create({ data: { itemId, code: `BLK${String(n).padStart(6, "0")}` } }));
  }
  return blocks;
}

// A block item's stock: the number of blocks not finished.
export async function recomputeQuantity(itemId: string) {
  const open = await prisma.inventoryBlock.count({ where: { itemId, finishedAt: null } });
  return prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: open } });
}

export function canSeeInventory(access: Access) {
  return can(access, "page.inventory") || can(access, "inventory.use");
}

export const isLow = (i: { quantity: number; minQuantity: number | null }) =>
  i.minQuantity != null && i.quantity <= i.minQuantity;

// "Zirconia disc · A2 · 98.5 x 18"
export function itemLabel(i: { name: string; colour: string | null; size: string | null }) {
  return [i.name, i.colour, i.size].filter(Boolean).join(" · ");
}

// "3 blocks" / "7"
export function stockText(i: { quantity: number; trackBlocks: boolean }): string {
  return i.trackBlocks ? `${i.quantity} block${i.quantity === 1 ? "" : "s"}` : String(i.quantity);
}

// What a block is called on screen: the name the lab leader gave it, or its code.
export function blockLabel(b: { name?: string | null; code: string }): string {
  return b.name?.trim() || b.code;
}
