import Link from "next/link";
import { Plus, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CASE_STATUSES, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

export default async function CasesPage() {
  const session = await requireSession();
  const { role, id: userId } = session.user;

  const cases = await prisma.case.findMany({
    where: role === "DESIGNER" ? { assignedDesignerId: userId } : undefined,
    include: { assignedDesigner: true, doctor: true },
    orderBy: { createdAt: "desc" },
  });

  const counts = CASE_STATUSES.reduce(
    (acc, status) => {
      acc[status] = cases.filter((c) => c.status === status).length;
      return acc;
    },
    {} as Record<CaseStatus, number>
  );

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
          <p className="mt-1 text-sm text-slate-500">
            {role === "DESIGNER" ? "Cases assigned to you" : "All lab cases"}
          </p>
        </div>
        {(role === "TECHNICIAN" || role === "LAB_LEADER") && (
          <Link
            href="/cases/new"
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            <Plus size={16} />
            New Case
          </Link>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {CASE_STATUSES.map((status) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-semibold text-slate-900">{counts[status]}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{CASE_STATUS_LABELS[status]}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">Designer</th>
              <th className="px-5 py-3 font-medium">Due</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-slate-50">
                <td className="px-5 py-4">
                  <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:text-brand">
                    {c.patientName}
                  </Link>
                </td>
                <td className="px-5 py-4 text-slate-500">{c.doctor.name}</td>
                <td className="px-5 py-4 text-slate-500">
                  {c.assignedDesigner?.name ?? (
                    <span className="text-slate-300">Unassigned</span>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {c.dueDate ? new Date(c.dueDate).toLocaleDateString() : "-"}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={c.status as CaseStatus} />
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                  <Inbox className="mx-auto mb-3 text-slate-300" size={28} />
                  No cases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
