import type { CaseStatus } from "@/lib/constants";
import { isBeforeIbar } from "@/lib/caseFlow";

export type EarningItem = { label: string; amount: number | null; done: boolean };

const AFTER_APPROVAL: CaseStatus[] = ["MILLING", "STAIN_AND_GLAZE", "COMPLETED", "DELIVERED"];
const FINISHED: CaseStatus[] = ["COMPLETED", "DELIVERED"];

type EarningFields = {
  status: string;
  ibarDesignerId: string | null;
  ibarDoneAt: Date | null;
  firstDesignerId: string | null;
  firstDesignerFee: number | null;
  assignedDesignerId: string | null;
  designerFee: number | null;
  ceramistId: string | null;
  ceramistFee: number | null;
  photogrammetryDoneById: string | null;
  photogrammetryCost: number | null;
};

// What one person earns on a case, and whether their part is done (so the
// amount is due). Uses the amounts locked onto the case.
export function earningsOnCase(c: EarningFields, userId: string): EarningItem[] {
  const status = c.status as CaseStatus;
  const items: EarningItem[] = [];

  if (c.firstDesignerId === userId) {
    items.push({
      label: "Design before ibar",
      amount: c.firstDesignerFee,
      // Approved by the Lab Leader: the case has moved on to the ibar.
      done: status === "IBAR_DESIGN" || !!c.ibarDoneAt,
    });
  }
  if (c.assignedDesignerId === userId) {
    items.push({
      label: c.ibarDesignerId ? "Design after ibar" : "Design",
      amount: c.designerFee,
      done: !isBeforeIbar(c) && AFTER_APPROVAL.includes(status),
    });
  }
  if (c.ceramistId === userId) {
    items.push({ label: "Stain & glaze", amount: c.ceramistFee, done: FINISHED.includes(status) });
  }
  if (c.photogrammetryDoneById === userId) {
    items.push({ label: "Photogrammetry", amount: c.photogrammetryCost, done: true });
  }
  return items;
}
