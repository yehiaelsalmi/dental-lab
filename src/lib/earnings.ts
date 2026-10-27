export type EarningItem = { label: string; amount: number | null; done: boolean };

type EarningFields = {
  status: string;
  printForTryIn?: boolean;
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
  assignments?: { userId: string; fee: number | null; role: { name: string } }[];
};

// What one person earns on a case, and whether their part is done (so the
// amount is due). Uses the amounts locked onto the case.
export function earningsOnCase(c: EarningFields, userId: string): EarningItem[] {
  // Nothing is earned until the case is delivered.
  const done = c.status === "DELIVERED";
  const items: EarningItem[] = [];

  if (c.firstDesignerId === userId) {
    items.push({ label: "Design before ibar", amount: c.firstDesignerFee, done });
  }
  if (c.assignedDesignerId === userId) {
    items.push({ label: c.ibarDesignerId ? "Design after ibar" : "Design", amount: c.designerFee, done });
  }
  if (c.ceramistId === userId) {
    items.push({ label: "Stain & glaze", amount: c.ceramistFee, done });
  }
  if (c.photogrammetryDoneById === userId) {
    items.push({ label: "Photogrammetry", amount: c.photogrammetryCost, done });
  }
  for (const a of c.assignments ?? []) {
    if (a.userId === userId) {
      items.push({ label: a.role.name, amount: a.fee, done });
    }
  }
  return items;
}
