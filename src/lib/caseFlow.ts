// Ibar cases have two designers: the first works before the ibar (and the Lab
// Leader reviews that design), the assigned designer takes over once the ibar
// is marked done. Every other case only has the assigned designer.

type IbarFields = { ibarDesignerId: string | null; ibarDoneAt: Date | null };
type DesignerFields = IbarFields & {
  firstDesignerId: string | null;
  assignedDesignerId: string | null;
};

export function isBeforeIbar(c: IbarFields): boolean {
  return !!c.ibarDesignerId && !c.ibarDoneAt;
}

// The designer who should be working on the case right now.
export function activeDesignerId(c: DesignerFields): string | null {
  return isBeforeIbar(c) ? c.firstDesignerId : c.assignedDesignerId;
}

export function isDesignerOnCase(c: DesignerFields, userId: string): boolean {
  return c.firstDesignerId === userId || c.assignedDesignerId === userId;
}
