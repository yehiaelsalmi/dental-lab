import { prisma } from "@/lib/prisma";

export const ADJUSTMENT_KINDS = { FEE: "Extra fee", DEDUCTION: "Deduction" } as const;
export type AdjustmentKind = keyof typeof ADJUSTMENT_KINDS;

export type AdjustmentInput = { kind: AdjustmentKind; amount: number; reason: string };

export function readAdjustment(kind: unknown, amount: unknown, reason: unknown): AdjustmentInput {
  if (typeof kind !== "string" || !Object.hasOwn(ADJUSTMENT_KINDS, kind)) throw new Error("Pick extra fee or deduction.");
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Enter an amount above zero.");
  const text = String(reason ?? "").trim().slice(0, 120);
  if (!text) throw new Error("Write the reason (e.g. \"Rush order\" or \"Remake discount\").");
  return { kind: kind as AdjustmentKind, amount: value, reason: text };
}

// Rows from the New Case form (adjKind / adjAmount / adjReason, one per row);
// rows left completely empty are skipped.
export function readAdjustmentRows(formData: FormData): AdjustmentInput[] {
  const kinds = formData.getAll("adjKind");
  const amounts = formData.getAll("adjAmount");
  const reasons = formData.getAll("adjReason");
  return kinds
    .map((kind, i) => ({ kind, amount: amounts[i], reason: reasons[i] }))
    .filter((r) => String(r.amount ?? "").trim() !== "" || String(r.reason ?? "").trim() !== "")
    .map((r) => readAdjustment(r.kind, r.amount, r.reason));
}

// Recomputes a case's extra fee and deduction totals from its list, keeping
// the price for the materials as it was.
export async function syncCaseTotals(caseId: string) {
  const c = await prisma.case.findUnique({ where: { id: caseId }, include: { adjustments: true } });
  if (!c) return;
  const sum = (kind: AdjustmentKind) =>
    c.adjustments.filter((a) => a.kind === kind).reduce((s, a) => s + a.amount, 0);
  const extraFee = sum("FEE");
  const deduction = sum("DEDUCTION");
  const base = (c.totalPrice ?? 0) - (c.extraFee ?? 0) + (c.deduction ?? 0);
  await prisma.case.update({
    where: { id: caseId },
    data: {
      extraFee: extraFee || null,
      deduction: deduction || null,
      totalPrice: c.totalPrice == null && !extraFee && !deduction ? null : base + extraFee - deduction,
    },
  });
}
