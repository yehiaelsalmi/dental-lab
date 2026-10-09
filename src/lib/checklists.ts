import { prisma } from "@/lib/prisma";

export type ChecklistEntry = {
  // "t:<templateItemId>" for template items, "c:<caseItemId>" for extras.
  key: string;
  text: string;
  done: boolean;
  doneBy: string | null;
  doneAt: Date | null;
  extraId: string | null;
};

// The checklist a case has in one status: the lab's items for that status
// (ticked or not) plus any extra items added to this case.
export async function caseChecklist(caseId: string, status: string): Promise<ChecklistEntry[]> {
  const [templates, items] = await Promise.all([
    prisma.checklistTemplateItem.findMany({
      where: { status },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.caseChecklistItem.findMany({
      where: { caseId, status },
      orderBy: { createdAt: "asc" },
      include: { doneBy: { select: { name: true } } },
    }),
  ]);

  const fromTemplates = templates.map((t) => {
    const state = items.find((i) => i.templateItemId === t.id);
    return {
      key: `t:${t.id}`,
      text: t.text,
      done: state?.done ?? false,
      doneBy: state?.done ? (state.doneBy?.name ?? null) : null,
      doneAt: state?.done ? state.doneAt : null,
      extraId: null,
    };
  });
  const extras = items
    .filter((i) => !i.templateItemId)
    .map((i) => ({
      key: `c:${i.id}`,
      text: i.text ?? "",
      done: i.done,
      doneBy: i.done ? (i.doneBy?.name ?? null) : null,
      doneAt: i.done ? i.doneAt : null,
      extraId: i.id,
    }));
  return [...fromTemplates, ...extras];
}

// A case can't leave a status while that status still has unticked items.
export async function assertChecklistDone(caseId: string, status: string, statusName: string) {
  const open = (await caseChecklist(caseId, status)).filter((e) => !e.done);
  if (open.length > 0) {
    throw new Error(
      `Finish the ${statusName} checklist first (${open.length} item${open.length === 1 ? "" : "s"} left: ${open
        .map((e) => e.text)
        .join(", ")}).`
    );
  }
}
