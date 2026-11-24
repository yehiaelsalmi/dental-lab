import { prisma } from "@/lib/prisma";
import { can, type Access } from "@/lib/access";

// Item codes are the system's own: "INV" + 5 digits. Letters and digits only,
// so a scanner set to any keyboard layout types them correctly.
export async function nextItemCode(): Promise<string> {
  const codes = await prisma.inventoryItem.findMany({ where: { code: { startsWith: "INV" } }, select: { code: true } });
  const max = codes.reduce((m, c) => Math.max(m, Number(c.code?.slice(3)) || 0), 0);
  return `INV${String(max + 1).padStart(5, "0")}`;
}

// What a scanner typed: tolerate spaces, lower case, or a whole link.
export function normalizeCode(raw: string): string {
  const match = raw.toUpperCase().match(/INV\d{3,}/);
  return match ? match[0] : raw.trim().toUpperCase();
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

type Stocked = { quantity: number; unitsPerBlock: number | null };

// "2 blocks + 12 units" for block items, "7" for pieces.
export function stockText(i: Stocked): string {
  if (!i.unitsPerBlock) return String(i.quantity);
  const full = Math.floor(i.quantity / i.unitsPerBlock);
  const rest = i.quantity % i.unitsPerBlock;
  const parts = [full ? `${full} block${full === 1 ? "" : "s"}` : "", rest ? `${rest} unit${rest === 1 ? "" : "s"}` : ""].filter(Boolean);
  return parts.join(" + ") || "0";
}

// An amount of stock: "4 units" for block items, "4" for pieces.
export function amountText(i: { unitsPerBlock: number | null }, n: number): string {
  return i.unitsPerBlock ? `${n} unit${Math.abs(n) === 1 ? "" : "s"}` : String(n);
}

// Minimum as the lab leader thinks of it (blocks for block items).
export function minText(i: { minQuantity: number | null; unitsPerBlock: number | null }): string {
  if (i.minQuantity == null) return "-";
  if (!i.unitsPerBlock) return String(i.minQuantity);
  const blocks = i.minQuantity / i.unitsPerBlock;
  return `${Number.isInteger(blocks) ? blocks : blocks.toFixed(1)} block${blocks === 1 ? "" : "s"}`;
}
