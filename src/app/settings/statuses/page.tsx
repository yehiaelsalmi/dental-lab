import { Lock, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { STATUS_COLORS, STATUS_COLOR_KEYS, getStatuses, type StatusInfo } from "@/lib/statuses";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { createStatus, deleteStatus, renameBuiltInStatus, updateStatus } from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function StatusesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  await requirePermission("page.statuses");
  const { error, saved, deleted } = await searchParams;

  const [statuses, custom, counts] = await Promise.all([
    getStatuses(),
    prisma.customStatus.findMany(),
    prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const caseCount = (key: string) => counts.find((c) => c.status === key)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Statuses</h1>
      <p className="mb-6 text-sm text-slate-500">
        Add your own statuses, such as &quot;Waiting for doctor&quot; or &quot;Polishing&quot;.
        People allowed to &quot;move a case to any status&quot; can put a case into any status from
        the case page. Built-in statuses can be renamed; their place in the workflow and their buttons stay the same.
      </p>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Status saved.</p>
      )}
      {deleted && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {deleted} was deleted.
        </p>
      )}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add a status</h2>
        <form action={createStatus} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
          <StatusFields statuses={statuses} />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover"
          >
            Add
          </button>
        </form>
      </section>

      <h2 className="mb-3 text-sm font-semibold text-slate-900">All statuses, in order</h2>
      <ul className="flex flex-col gap-2">
        {statuses.map((s) => {
          const row = custom.find((c) => c.key === s.key);
          const count = caseCount(s.key);
          return (
            <li key={s.key} className="rounded-xl border border-slate-200 bg-white p-4">
              {s.builtIn || !row ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <form action={renameBuiltInStatus} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="key" value={s.key} />
                    <Badge info={s} />
                    <input
                      name="label"
                      required
                      defaultValue={s.label}
                      aria-label={`Name for ${s.label}`}
                      className={`${INPUT} min-w-0 flex-1`}
                    />
                    <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                      Rename
                    </button>
                  </form>
                  <span className="flex items-center gap-2 text-xs text-slate-400" title="Built-in: its place and buttons are fixed">
                    {count} case{count === 1 ? "" : "s"}
                    <Lock size={13} />
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <form action={updateStatus} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
                    <input type="hidden" name="id" value={row.id} />
                    <StatusFields statuses={statuses} values={row} />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Save
                    </button>
                  </form>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>
                      {count} case{count === 1 ? "" : "s"} in this status
                    </span>
                    {count === 0 && (
                      <form action={deleteStatus}>
                        <input type="hidden" name="id" value={row.id} />
                        <ConfirmSubmitButton
                          message={`Delete the status "${row.label}"?`}
                          className="flex items-center gap-1 font-medium text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 size={13} />
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Badge({ info }: { info: StatusInfo }) {
  const c = STATUS_COLORS[info.color];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {info.label}
    </span>
  );
}

function StatusFields({
  statuses,
  values,
}: {
  statuses: StatusInfo[];
  values?: { key: string; label: string; color: string; afterStatus: string };
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Name
        <input name="label" required defaultValue={values?.label} placeholder="e.g. Waiting for doctor" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Colour
        <select name="color" defaultValue={values?.color ?? "slate"} className={INPUT}>
          {STATUS_COLOR_KEYS.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Comes after
        <select name="afterStatus" required defaultValue={values?.afterStatus ?? "COMPLETED"} className={INPUT}>
          {statuses
            .filter((s) => s.key !== values?.key)
            .map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
        </select>
      </label>
    </>
  );
}
