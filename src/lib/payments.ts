import { prisma } from "@/lib/prisma";
import { earningsOnCase } from "@/lib/earnings";

export const STAFF_PAYMENT_KINDS = {
  FEES: "Toward case fees (advances too)",
  SALARY: "Salary / other",
} as const;
export type StaffPaymentKind = keyof typeof STAFF_PAYMENT_KINDS;

// Payment dates are calendar days, stored as midnight UTC.
export function parsePaidAt(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPaidAt(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

export type DoctorBalance = {
  id: string;
  name: string;
  cases: number;
  unpriced: number;
  owed: number;
  paid: number;
  // Positive: the doctor still owes this. Negative: credit (paid in advance).
  balance: number;
};

// Owed = the price of every case for the doctor; paid = payments entered.
export async function doctorBalances(doctorId?: string): Promise<DoctorBalance[]> {
  const where = doctorId ? { doctorId } : {};
  const [doctors, priced, unpriced, payments] = await Promise.all([
    prisma.doctor.findMany({ where: doctorId ? { id: doctorId } : {}, orderBy: { name: "asc" } }),
    prisma.case.groupBy({ by: ["doctorId"], where, _sum: { totalPrice: true }, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["doctorId"], where: { ...where, totalPrice: null }, _count: { _all: true } }),
    prisma.doctorPayment.groupBy({ by: ["doctorId"], where, _sum: { amount: true } }),
  ]);
  return doctors.map((d) => {
    const c = priced.find((p) => p.doctorId === d.id);
    const owed = c?._sum.totalPrice ?? 0;
    const paid = payments.find((p) => p.doctorId === d.id)?._sum.amount ?? 0;
    return {
      id: d.id,
      name: d.name,
      cases: c?._count._all ?? 0,
      unpriced: unpriced.find((p) => p.doctorId === d.id)?._count._all ?? 0,
      owed,
      paid,
      balance: owed - paid,
    };
  });
}

export type StaffBalance = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  // Fees for parts that are done (due) and still in progress.
  earned: number;
  pending: number;
  paidFees: number;
  paidOther: number;
  // Positive: the lab still owes them this. Negative: paid ahead.
  balance: number;
};

const caseInclude = { assignments: { include: { role: true } } } as const;

function casesFor(userIds: string[]) {
  return prisma.case.findMany({
    where: {
      OR: [
        { firstDesignerId: { in: userIds } },
        { assignedDesignerId: { in: userIds } },
        { ceramistId: { in: userIds } },
        { photogrammetryDoneById: { in: userIds } },
        { assignments: { some: { userId: { in: userIds } } } },
      ],
    },
    include: { ...caseInclude, doctor: true },
    orderBy: { entryDate: "desc" },
  });
}

// Everyone who earns on cases or has been paid, except removed accounts with
// nothing recorded.
export async function staffBalances(userId?: string): Promise<StaffBalance[]> {
  const users = await prisma.user.findMany({
    where: userId
      ? { id: userId }
      : { OR: [{ deletedAt: null }, { staffPayments: { some: {} } }] },
    include: { role: true },
    orderBy: { name: "asc" },
  });
  const ids = users.map((u) => u.id);
  const [cases, payments] = await Promise.all([
    casesFor(ids),
    prisma.staffPayment.groupBy({ by: ["userId", "kind"], where: { userId: { in: ids } }, _sum: { amount: true } }),
  ]);

  return users.map((u) => {
    const items = cases.flatMap((c) => earningsOnCase(c, u.id));
    const sum = (done: boolean) => items.filter((i) => i.done === done).reduce((s, i) => s + (i.amount ?? 0), 0);
    const paid = (kind: StaffPaymentKind) =>
      payments.find((p) => p.userId === u.id && p.kind === kind)?._sum.amount ?? 0;
    const earned = sum(true);
    return {
      id: u.id,
      name: u.name,
      role: u.role.name,
      active: u.active && !u.deletedAt,
      earned,
      pending: sum(false),
      paidFees: paid("FEES"),
      paidOther: paid("SALARY"),
      balance: earned - paid("FEES"),
    };
  });
}

// The cases one person earns on, with what they earn on each.
export async function staffCaseEarnings(userId: string) {
  const cases = await casesFor([userId]);
  return cases
    .map((c) => ({ c, items: earningsOnCase(c, userId) }))
    .filter((r) => r.items.length > 0);
}
