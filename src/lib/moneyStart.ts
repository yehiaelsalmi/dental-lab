import { cache } from "react";
import { getSetting } from "@/lib/settings";

// The Lab Leader can start counting money afresh from a month (Lab settings):
// Reports, payment balances and earnings then ignore cases delivered,
// payments made and expenses/salaries before it. Nothing is deleted; clearing
// the setting counts everything again.
export const MONEY_START_KEY = "money.startMonth";

export const getMoneyStartMonth = cache(async (): Promise<string | null> => {
  const value = await getSetting(MONEY_START_KEY);
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
});

export async function getMoneyStart(): Promise<Date | null> {
  const key = await getMoneyStartMonth();
  if (!key) return null;
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

// Cases whose money counts: not delivered yet, or delivered from the start.
export function countedCasesWhere(start: Date | null) {
  return start ? { OR: [{ deliveredAt: null }, { deliveredAt: { gte: start } }] } : {};
}

// The later of a date and the start (when there is one).
export function notBeforeStart(date: Date, start: Date | null): Date {
  return start && start > date ? start : date;
}
