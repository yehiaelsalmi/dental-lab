import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DESIGN_PHASE_STATUSES, type CaseStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

export default async function DesignersPage() {
  await requireRole("LAB_LEADER");

  const [designers, unassignedCount] = await Promise.all([
    prisma.user.findMany({
      where: { role: "DESIGNER" },
      orderBy: { name: "asc" },
      include: {
        casesAssigned: {
          orderBy: { createdAt: "desc" },
          include: { doctor: true },
        },
      },
    }),
    prisma.case.count({
      where: { assignedDesignerId: null, status: { in: DESIGN_PHASE_STATUSES } },
    }),
  ]);

  const rows = designers
    .map((d) => {
      const open = d.casesAssigned.filter((c) =>
        DESIGN_PHASE_STATUSES.includes(c.status as CaseStatus)
      );
      return { designer: d, open, total: d.casesAssigned.length };
    })
    .sort((a, b) => b.open.length - a.open.length);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Designers</h1>
      <p className="mb-6 text-sm text-slate-500">
        How many cases each designer has, and which ones. &quot;Open&quot; means the case is still
        in the design stage (ready, in design, waiting for review or changes requested).
      </p>

      {unassignedCount > 0 && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {unassignedCount} case{unassignedCount === 1 ? " is" : "s are"} in the design stage with
          no designer assigned.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {rows.map(({ designer, open, total }) => (
          <section
            key={designer.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
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

            {designer.casesAssigned.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-400">No cases assigned.</p>
            ) : (
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[38%]" />
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <tbody className="divide-y divide-slate-100">
                  {designer.casesAssigned.map((c) => (
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
