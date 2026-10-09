import Link from "next/link";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { STATUS_COLORS, findStatus, getStatuses } from "@/lib/statuses";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  addChecklistTemplateItem,
  deleteChecklistTemplateItem,
  moveChecklistTemplateItem,
  updateChecklistTemplateItem,
} from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  await requirePermission("page.checklists");
  const params = await searchParams;
  const statuses = await getStatuses();
  const current = findStatus(statuses, params.status && statuses.some((s) => s.key === params.status) ? params.status : statuses[0].key);

  const [items, counts] = await Promise.all([
    prisma.checklistTemplateItem.findMany({
      where: { status: current.key },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.checklistTemplateItem.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countFor = (key: string) => counts.find((c) => c.status === key)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Checklists</h1>
      <p className="mb-6 text-sm text-slate-500">
        Items to tick on every case while it is in a status. A case can&apos;t move on to the next
        status until its checklist is done. You can also add extra items to a single case from the
        case page.
      </p>

      {params.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        {statuses.map((s) => {
          const active = s.key === current.key;
          const n = countFor(s.key);
          return (
            <Link
              key={s.key}
              href={`/settings/checklists?status=${encodeURIComponent(s.key)}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${
                active ? STATUS_COLORS[s.color].badge + " ring-2" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[s.color].dot}`} />
              {s.label}
              {n > 0 && <span className="text-slate-400">({n})</span>}
            </Link>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">{current.label} checklist</h2>
        {items.length === 0 ? (
          <p className="mb-4 text-sm text-slate-400">No items yet. Cases in {current.label} can move on freely.</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs text-slate-400">{index + 1}.</span>
                <form action={updateChecklistTemplateItem} className="flex min-w-0 flex-1 gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    name="text"
                    required
                    maxLength={200}
                    defaultValue={item.text}
                    aria-label={`Item ${index + 1}`}
                    className={`${INPUT} min-w-0 flex-1`}
                  />
                  <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Save
                  </button>
                </form>
                <form action={moveChecklistTemplateItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" disabled={index === 0} className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp size={15} />
                  </button>
                </form>
                <form action={moveChecklistTemplateItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={index === items.length - 1}
                    className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown size={15} />
                  </button>
                </form>
                <form action={deleteChecklistTemplateItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmSubmitButton
                    message={`Remove "${item.text}" from the ${current.label} checklist? Its ticks on cases are removed too.`}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </ConfirmSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addChecklistTemplateItem} className="flex gap-2 border-t border-slate-100 pt-4">
          <input type="hidden" name="status" value={current.key} />
          <input
            name="text"
            required
            maxLength={200}
            placeholder={`e.g. Check the shade with the doctor's photo`}
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover">
            Add item
          </button>
        </form>
      </section>
    </div>
  );
}
