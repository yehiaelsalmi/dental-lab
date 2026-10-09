import type { CaseStatus } from "@/lib/constants";
import { activeDesignerId } from "@/lib/caseFlow";

// Defaults; the Lab Leader can change both on Lab Settings.
export const DEFAULT_ALERT_OPTIONS = { staleDays: 2, dueSoonDays: 1 };
export type AlertOptions = typeof DEFAULT_ALERT_OPTIONS;

const LAB_TIME_ZONE = "Africa/Cairo";
const FINISHED: CaseStatus[] = ["COMPLETED", "DELIVERED"];
const WAITING_ON_DESIGNER: CaseStatus[] = [
  "READY_FOR_DESIGN",
  "IN_DESIGN",
  "CHANGES_REQUESTED",
  "REDESIGN",
];
const DAY_MS = 24 * 60 * 60 * 1000;

export type CaseAlert = { label: string };

// "YYYY-MM-DD" for a moment as seen on the lab's wall clock.
function labDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAB_TIME_ZONE }).format(
    date,
  );
}

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Why a case needs attention, or null if it doesn't. Due dates are stored as
// midnight UTC of the chosen day, so their ISO date is the day itself.
export function getCaseAlert(
  c: {
    status: string;
    dueDate: Date | null;
    assignedDesignerId: string | null;
    firstDesignerId: string | null;
    ibarDesignerId: string | null;
    ibarDoneAt: Date | null;
    updatedAt: Date;
  },
  now: Date = new Date(),
  options: AlertOptions = DEFAULT_ALERT_OPTIONS,
): CaseAlert | null {
  const status = c.status as CaseStatus;
  if (FINISHED.includes(status)) return null;

  if (c.dueDate) {
    const today = labDateKey(now);
    const due = c.dueDate.toISOString().slice(0, 10);
    if (due < today) return { label: "Overdue" };
    if (due === today) return { label: "Due today" };
    for (let d = 1; d <= options.dueSoonDays; d++) {
      if (due === addDays(today, d)) {
        return { label: d === 1 ? "Due tomorrow" : `Due in ${d} days` };
      }
    }
  }

  if (activeDesignerId(c) && WAITING_ON_DESIGNER.includes(status)) {
    const idleDays = Math.floor(
      (now.getTime() - c.updatedAt.getTime()) / DAY_MS,
    );
    if (idleDays >= options.staleDays)
      return { label: `No progress for ${idleDays} days` };
  }

  return null;
}
