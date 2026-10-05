import type { CaseStatus } from "@/lib/constants";
import { activeDesignerId } from "@/lib/caseFlow";

// A case assigned to a designer that hasn't moved for this many days counts
// as forgotten.
export const STALE_DAYS = 2;

const LAB_TIME_ZONE = "Africa/Cairo";
const FINISHED: CaseStatus[] = ["COMPLETED", "DELIVERED"];
const WAITING_ON_DESIGNER: CaseStatus[] = [
  "READY_FOR_DESIGN",
  "IN_DESIGN",
  "CHANGES_REQUESTED",
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
): CaseAlert | null {
  const status = c.status as CaseStatus;
  if (FINISHED.includes(status)) return null;

  if (c.dueDate) {
    const today = labDateKey(now);
    const due = c.dueDate.toISOString().slice(0, 10);
    if (due < today) return { label: "Overdue" };
    if (due === today) return { label: "Due today" };
    if (due === addDays(today, 1)) return { label: "Due tomorrow" };
  }

  if (activeDesignerId(c) && WAITING_ON_DESIGNER.includes(status)) {
    const idleDays = Math.floor(
      (now.getTime() - c.updatedAt.getTime()) / DAY_MS,
    );
    if (idleDays >= STALE_DAYS)
      return { label: `No progress for ${idleDays} days` };
  }

  return null;
}
