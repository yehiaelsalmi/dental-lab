import Link from "next/link";
import { requirePermission, usersWithPermission } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatEGP } from "@/lib/money";
import type { CaseStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

const FINISHED_STATUSES = ["COMPLETED", "DELIVERED"];

export default async function CeramistsPage() {
  await requirePermission("page.ceramists");

  // Ceramists are users whose role can be assigned as ceramist.
  const ceramistIds = (await usersWithPermission("work.ceramist")).map((u) => u.id);
  const [ceramistUsers, waitingCount] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ceramistIds } },
      orderBy: { name: "asc" },
      include: {
        casesAsCeramist: {
          orderBy: { createdAt: "desc" },
          include: { doctor: true },
        },
      },
    }),
    prisma.case.count({ where: { ceramistId: null, status: "STAIN_AND_GLAZE" } }),
  ]);

  const rows = ceramistUsers
    .map(({ casesAsCeramist, ...ceramist }) => ({ ...ceramist, cases: casesAsCeramist }))
    .map((ceramist) => {
      const open = ceramist.cases.filter((c) => !FINISHED_STATUSES.includes(c.status));
      const fees = ceramist.cases.reduce((sum, c) => sum + (c.ceramistFee ?? 0), 0);
      return { ceramist, open, fees, total: ceramist.cases.length };
    })
    .sort((a, b) => b.open.length - a.open.length);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Ceramists</h1>
      <p className="mb-6 text-sm text-slate-500">
        How many cases each ceramist has, and which ones. &quot;Open&quot; means the case is not
        yet completed or delivered.
      </p>

      {waitingCount > 0 && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {waitingCount} case{waitingCount === 1 ? " is" : "s are"} in Stain &amp; Glaze with no
          ceramist assigned.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {rows.map(({ ceramist, open, fees, total }) => (
          <section
            key={ceramist.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                {ceramist.name}
              </p>
              <div className="flex shrink-0 gap-6 text-right">
                <div>
                  <p className="text-lg font-semibold text-brand">{open.length}</p>
                  <p className="text-xs text-slate-500">Open</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{formatEGP(fees)}</p>
                  <p className="text-xs text-slate-500">Fees</p>
                </div>
              </div>
            </div>

            {ceramist.cases.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-400">No cases assigned.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <tbody className="divide-y divide-slate-100">
                  {ceramist.cases.map((c) => (
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
                      <td className="px-5 py-2.5 text-slate-500">{formatEGP(c.ceramistFee)}</td>
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
            No ceramist accounts yet. Add users with a role that can be assigned as ceramist (for example the Ceramist role).
          </p>
        )}
      </div>
    </div>
  );
}
