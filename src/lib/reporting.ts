import { prisma } from "@/lib/prisma";
import { materialSummary, metalSummary } from "@/lib/caseMaterials";
import { monthStart, nextMonthStart } from "@/lib/overheads";
import { formatFieldValue } from "@/lib/customFields";

// Cases entered in a month ("YYYY-MM"), or every case when no month is given.
export async function getReportCases(month?: string) {
  return prisma.case.findMany({
    where: month ? { entryDate: { gte: monthStart(month), lt: nextMonthStart(month) } } : undefined,
    orderBy: { entryDate: "desc" },
    include: {
      doctor: true,
      materials: { orderBy: { createdAt: "asc" }, include: { material: true, metalType: true } },
      ceramist: true,
      ibarDesigner: true,
      assignedDesigner: true,
      firstDesigner: true,
      assignments: { include: { role: true, user: true } },
      fieldValues: true,
    },
  });
}

// A case's value for one custom field, formatted for a report cell.
export function caseFieldText(c: ReportCase, field: { id: string; type: string }): string {
  return formatFieldValue(field.type, c.fieldValues.find((v) => v.fieldId === field.id)?.value);
}

export type ReportCase = Awaited<ReturnType<typeof getReportCases>>[number];

// One-cell descriptions of a case's material lines, for tables and exports.
export function caseMaterialsText(c: ReportCase): string {
  return materialSummary(c.materials);
}

export function caseMetalsText(c: ReportCase): string {
  return metalSummary(c.materials);
}

export function caseUnits(c: { unitsUpper: number | null; unitsLower: number | null }): number {
  return (c.unitsUpper ?? 0) + (c.unitsLower ?? 0);
}

export function caseProfit(c: ReportCase): number {
  return (
    (c.totalPrice ?? 0) -
    (c.ceramistFee ?? 0) -
    (c.designerFee ?? 0) -
    (c.firstDesignerFee ?? 0) -
    (c.ibarFee ?? 0) -
    (c.metalCost ?? 0) -
    (c.millingCost ?? 0) -
    (c.photogrammetryCost ?? 0) -
    staffFees(c)
  );
}

// Fees for people from assignable roles (milling, printing, ...) on a case.
export function staffFees(c: { assignments: { fee: number | null }[] }): number {
  return c.assignments.reduce((sum, a) => sum + (a.fee ?? 0), 0);
}

// "Milling: Ahmed, Printing: Sara" for one report cell.
export function staffText(c: ReportCase): string {
  return c.assignments.map((a) => `${a.role.name}: ${a.user.name}`).join(", ");
}

export function computeTotals(cases: ReportCase[]) {
  const totals = cases.reduce(
    (acc, c) => {
      acc.price += c.totalPrice ?? 0;
      acc.ceramist += c.ceramistFee ?? 0;
      acc.designer += (c.designerFee ?? 0) + (c.firstDesignerFee ?? 0);
      acc.ibar += c.ibarFee ?? 0;
      acc.metal += c.metalCost ?? 0;
      acc.milling += c.millingCost ?? 0;
      acc.photogrammetry += c.photogrammetryCost ?? 0;
      acc.staff += staffFees(c);
      return acc;
    },
    { price: 0, ceramist: 0, designer: 0, ibar: 0, metal: 0, milling: 0, photogrammetry: 0, staff: 0 }
  );
  const profit =
    totals.price -
    totals.ceramist -
    totals.designer -
    totals.ibar -
    totals.metal -
    totals.milling -
    totals.photogrammetry -
    totals.staff;
  return { ...totals, profit };
}

// Both designers on an ibar case, for one-column report cells.
export function designerNames(c: ReportCase): string {
  return [c.firstDesigner?.name, c.assignedDesigner?.name].filter(Boolean).join(" / ");
}

export function designerFees(c: ReportCase): number | null {
  if (c.designerFee == null && c.firstDesignerFee == null) return null;
  return (c.designerFee ?? 0) + (c.firstDesignerFee ?? 0);
}

export type PersonTotal = { id: string; name: string; count: number; amount: number };

const BREAKDOWN_KEYS = ["doctor", "ceramist", "designer", "ibar", "staff"] as const;
export type BreakdownKey = (typeof BREAKDOWN_KEYS)[number];

export const BREAKDOWN_LABELS: Record<BreakdownKey, string> = {
  doctor: "Doctors (revenue)",
  ceramist: "Ceramists (fees)",
  designer: "Designers (fees)",
  ibar: "Ibar designers (fees)",
  staff: "Other roles (fees)",
};

export function breakdownBy(cases: ReportCase[], key: BreakdownKey): PersonTotal[] {
  const map = new Map<string, PersonTotal>();

  for (const c of cases) {
    // A case can pay more than one person in a category (two designers on an
    // ibar case), so collect every share first.
    const shares: { id: string | null; name: string | undefined; amount: number }[] =
      key === "doctor"
        ? [{ id: c.doctorId, name: c.doctor.name, amount: c.totalPrice ?? 0 }]
        : key === "ceramist"
          ? [{ id: c.ceramistId, name: c.ceramist?.name, amount: c.ceramistFee ?? 0 }]
          : key === "designer"
            ? [
                { id: c.firstDesignerId, name: c.firstDesigner?.name, amount: c.firstDesignerFee ?? 0 },
                { id: c.assignedDesignerId, name: c.assignedDesigner?.name, amount: c.designerFee ?? 0 },
              ]
            : key === "ibar"
              ? [{ id: c.ibarDesignerId, name: c.ibarDesigner?.name, amount: c.ibarFee ?? 0 }]
              : c.assignments.map((a) => ({
                  id: a.userId,
                  name: `${a.user.name} (${a.role.name})`,
                  amount: a.fee ?? 0,
                }));

    for (const { id, name, amount } of shares) {
      if (!id || !name) continue;
      const existing = map.get(id) ?? { id, name, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += amount;
      map.set(id, existing);
    }
  }

  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function allBreakdowns(cases: ReportCase[]): Record<BreakdownKey, PersonTotal[]> {
  return Object.fromEntries(
    BREAKDOWN_KEYS.map((key) => [key, breakdownBy(cases, key)])
  ) as Record<BreakdownKey, PersonTotal[]>;
}
