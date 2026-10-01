import { prisma } from "@/lib/prisma";

export async function getReportCases() {
  return prisma.case.findMany({
    orderBy: { entryDate: "desc" },
    include: {
      doctor: true,
      material: true,
      metalType: true,
      ceramist: true,
      ibarDesigner: true,
      assignedDesigner: true,
    },
  });
}

export type ReportCase = Awaited<ReturnType<typeof getReportCases>>[number];

export function caseUnits(c: { unitsUpper: number | null; unitsLower: number | null }): number {
  return (c.unitsUpper ?? 0) + (c.unitsLower ?? 0);
}

export function caseProfit(c: ReportCase): number {
  return (
    (c.totalPrice ?? 0) -
    (c.ceramistFee ?? 0) -
    (c.designerFee ?? 0) -
    (c.ibarFee ?? 0) -
    (c.metalCost ?? 0)
  );
}

export function computeTotals(cases: ReportCase[]) {
  const totals = cases.reduce(
    (acc, c) => {
      acc.price += c.totalPrice ?? 0;
      acc.ceramist += c.ceramistFee ?? 0;
      acc.designer += c.designerFee ?? 0;
      acc.ibar += c.ibarFee ?? 0;
      acc.metal += c.metalCost ?? 0;
      return acc;
    },
    { price: 0, ceramist: 0, designer: 0, ibar: 0, metal: 0 }
  );
  const profit = totals.price - totals.ceramist - totals.designer - totals.ibar - totals.metal;
  return { ...totals, profit };
}

export type PersonTotal = { id: string; name: string; count: number; amount: number };

const BREAKDOWN_KEYS = ["doctor", "ceramist", "designer", "ibar"] as const;
export type BreakdownKey = (typeof BREAKDOWN_KEYS)[number];

export const BREAKDOWN_LABELS: Record<BreakdownKey, string> = {
  doctor: "Doctors (revenue)",
  ceramist: "Ceramists (fees)",
  designer: "Designers (fees)",
  ibar: "Ibar designers (fees)",
};

export function breakdownBy(cases: ReportCase[], key: BreakdownKey): PersonTotal[] {
  const map = new Map<string, PersonTotal>();

  for (const c of cases) {
    let id: string | null;
    let name: string | undefined;
    let amount: number;

    if (key === "doctor") {
      id = c.doctorId;
      name = c.doctor.name;
      amount = c.totalPrice ?? 0;
    } else if (key === "ceramist") {
      id = c.ceramistId;
      name = c.ceramist?.name;
      amount = c.ceramistFee ?? 0;
    } else if (key === "designer") {
      id = c.assignedDesignerId;
      name = c.assignedDesigner?.name;
      amount = c.designerFee ?? 0;
    } else {
      id = c.ibarDesignerId;
      name = c.ibarDesigner?.name;
      amount = c.ibarFee ?? 0;
    }

    if (!id || !name) continue;

    const existing = map.get(id) ?? { id, name, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += amount;
    map.set(id, existing);
  }

  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function allBreakdowns(cases: ReportCase[]): Record<BreakdownKey, PersonTotal[]> {
  return Object.fromEntries(
    BREAKDOWN_KEYS.map((key) => [key, breakdownBy(cases, key)])
  ) as Record<BreakdownKey, PersonTotal[]>;
}
