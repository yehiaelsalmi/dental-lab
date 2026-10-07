import { prisma } from "@/lib/prisma";

// Months are handled as "YYYY-MM" keys; dates are the first day of the month (UTC).
export function monthStart(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function nextMonthStart(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
}

export function isMonthKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// The current month on the lab's clock.
export function currentMonthKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date()).slice(0, 7);
}

export function monthLabel(key: string): string {
  return monthStart(key).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type Overheads = {
  expenses: { id: string; name: string; amount: number; recurring: boolean }[];
  salaries: { id: string; name: string; amount: number }[];
  expenseTotal: number;
  salaryTotal: number;
};

// Expenses and salaries that count in a month. A recurring expense counts
// from its start month through its end month (or forever); a one-off only in
// its own month. Salaries are everyone's current base salary.
export async function overheadsForMonth(key: string): Promise<Overheads> {
  const start = monthStart(key);
  const [expenseRows, people] = await Promise.all([
    prisma.expense.findMany({
      where: {
        OR: [
          { recurring: false, month: start },
          {
            recurring: true,
            month: { lte: start },
            OR: [{ endMonth: null }, { endMonth: { gte: start } }],
          },
        ],
      },
      orderBy: [{ recurring: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { deletedAt: null, active: true, baseSalary: { gt: 0 } },
      orderBy: { name: "asc" },
    }),
  ]);

  const expenses = expenseRows.map((e) => ({ id: e.id, name: e.name, amount: e.amount, recurring: e.recurring }));
  const salaries = people.map((u) => ({ id: u.id, name: u.name, amount: u.baseSalary ?? 0 }));
  return {
    expenses,
    salaries,
    expenseTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
    salaryTotal: salaries.reduce((sum, s) => sum + s.amount, 0),
  };
}
