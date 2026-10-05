import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DESIGN_PHASE_STATUSES, type CaseStatus } from "@/lib/constants";
import { activeDesignerId } from "@/lib/caseFlow";
import { StatusBadge } from "@/components/StatusBadge";

export default async function DesignersPage() {
  await requireRole("LAB_LEADER");

  const [designers, designPhaseCases] = await Promise.all([
    prisma.user.findMany({
      where: { role: "DESIGNER" },
      orderBy: { name: "asc" },
      include: {
        casesAssigned: { include: { doctor: true } },
        casesFirstDesigned: { include: { doctor: true } },
      },
    }),
    prisma.case.findMany({ where: { status: { in: DESIGN_PHASE_STATUSES } } }),
  ]);
  // Cases in the design stage whose current designer slot is empty.
  const unassignedCount = designPhaseCases.filter(
    (c) => c.status !== "IBAR_DESIGN" && !activeDesignerId(c)
  ).length;

  const rows = designers
    .map((d) => {
      // A designer can be on an ibar case before the ibar, after it, or both.
      const byId = new Map(
        [...d.casesAssigned, ...d.casesFirstDesigned].map((c) => [c.id, c])
      );
      const cases = [...byId.values()].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      // Open = it's their turn on a case still in the design stage.
      const open = cases.filter(
        (c) =>
          DESIGN_PHASE_STATUSES.includes(c.status as CaseStatus) &&
          activeDesignerId(c) === d.id
      );
      return { designer: d, cases, open, total: cases.length };
    })
    .sort((a, b) => b.open.length - a.open.length);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Designers</h1>
      <p className="mb-6 text-sm text-slate-500">
        How many cases each designer has, and which ones. &quot;Open&quot; means it&apos;s their
        turn on a case still in the design stage. On ibar cases that&apos;s the designer before the
        ibar until the ibar is done, then the designer after it.
      </p>

      {unassignedCount > 0 && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {unassignedCount} case{unassignedCount === 1 ? " is" : "s are"} in the design stage with
          no designer assigned.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {rows.map(({ designer, cases, open, total }) => (
          <section
            key={designer.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {designer.name}
                  {!designer.active && (
                    <span className="ml-2 text-xs font-normal text-slate-400">(disabled)</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{designer.email}</p>
              </div>
              <div className="flex shrink-0 gap-6 text-right">
                <div>
                  <p className="text-lg font-semibold text-brand">{open.length}</p>
                  <p className="text-xs text-slate-500">Open</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </div>

            {cases.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-400">No cases assigned.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[38%]" />
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <tbody className="divide-y divide-slate-100">
                  {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/cases/${c.id}`}
                          className="block truncate font-medium text-slate-900 hover:text-brand"
                        >
                          {c.patientName}
                        </Link>
                      </td>
                      <td className="truncate px-5 py-2.5 text-slate-500">{c.doctor.name}</td>
                      <td className="px-5 py-2.5 text-slate-500">
                        {c.dueDate ? `Due ${new Date(c.dueDate).toLocaleDateString()}` : "No due date"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <StatusBadge status={c.status as CaseStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>
        ))}
        {rows.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
            No designer accounts yet. Add them from the Users page.
          </p>
        )}
      </div>
    </div>
  );
}
