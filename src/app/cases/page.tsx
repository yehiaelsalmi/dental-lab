import Link from "next/link";
import { Plus, Inbox, Search, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CASE_STATUSES, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: statusParam, q } = await searchParams;
  const query = (q ?? "").trim();
  const activeStatus = (CASE_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as CaseStatus)
    : null;
  const session = await requireSession();
  const { role, id: userId } = session.user;

  const cases = await prisma.case.findMany({
    where: role === "DESIGNER" ? { assignedDesignerId: userId } : undefined,
    include: { assignedDesigner: true, doctor: true },
    orderBy: { createdAt: "desc" },
  });

  // Matches anywhere in the patient or doctor name, ignoring case.
  const needle = query.toLowerCase();
  const matchingCases = needle
    ? cases.filter(
        (c) =>
          c.patientName.toLowerCase().includes(needle) ||
          c.doctor.name.toLowerCase().includes(needle)
      )
    : cases;

  const counts = CASE_STATUSES.reduce(
    (acc, status) => {
      acc[status] = matchingCases.filter((c) => c.status === status).length;
      return acc;
    },
    {} as Record<CaseStatus, number>
  );

  const visibleCases = activeStatus
    ? matchingCases.filter((c) => c.status === activeStatus)
    : matchingCases;

  const withParams = (params: { status?: string | null; q?: string }) => {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.q) search.set("q", params.q);
    const qs = search.toString();
    return qs ? `/cases?${qs}` : "/cases";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
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

      <form action="/cases" className="mb-4 flex gap-2">
        {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by patient or doctor name"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Search
        </button>
        {query && (
          <Link
            href={withParams({ status: activeStatus })}
            aria-label="Clear search"
            className="flex items-center rounded-lg border border-slate-300 bg-white px-3 text-slate-500 hover:bg-slate-50"
          >
            <X size={16} />
          </Link>
        )}
      </form>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {CASE_STATUSES.map((status) => {
          const active = status === activeStatus;
          return (
            <Link
              key={status}
              href={withParams({ status: active ? null : status, q: query })}
              className={`rounded-xl border p-4 transition-colors ${
                active
                  ? "border-brand bg-brand-soft"
                  : "border-slate-200 bg-white hover:border-brand/40 hover:bg-slate-50"
              }`}
            >
              <p className={`text-2xl font-semibold ${active ? "text-brand" : "text-slate-900"}`}>
                {counts[status]}
              </p>
              <p className={`mt-1 text-xs font-medium ${active ? "text-brand" : "text-slate-500"}`}>
                {CASE_STATUS_LABELS[status]}
              </p>
            </Link>
          );
        })}
      </div>

      <p className="mb-4 text-sm text-slate-500">
        {activeStatus || query ? (
          <>
            Showing {visibleCases.length} case{visibleCases.length === 1 ? "" : "s"}
            {query && (
              <>
                {" "}matching <span className="font-medium text-slate-900">&quot;{query}&quot;</span>
              </>
            )}
            {activeStatus && (
              <>
                {" "}in <span className="font-medium text-slate-900">{CASE_STATUS_LABELS[activeStatus]}</span>
              </>
            )}
            .{" "}
            <Link href="/cases" className="font-medium text-brand hover:text-brand-hover">
              Show all
            </Link>
          </>
        ) : (
          "Click a status to see only the cases in it."
        )}
      </p>

      <ul className="flex flex-col gap-3 sm:hidden">
        {visibleCases.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cases/${c.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words font-medium text-slate-900">{c.patientName}</p>
                <StatusBadge status={c.status as CaseStatus} />
              </div>
              <p className="mt-1 text-sm text-slate-500">{c.doctor.name}</p>
              <p className="mt-2 text-xs text-slate-400">
                {c.assignedDesigner?.name ?? "Unassigned"}
                {c.dueDate ? ` - Due ${new Date(c.dueDate).toLocaleDateString()}` : ""}
              </p>
            </Link>
          </li>
        ))}
        {visibleCases.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
            {query ? "No cases match your search." : activeStatus ? "No cases in this status." : "No cases yet."}
          </li>
        )}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
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
            {visibleCases.map((c) => (
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
            {visibleCases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                  <Inbox className="mx-auto mb-3 text-slate-300" size={28} />
                  {query ? "No cases match your search." : activeStatus ? "No cases in this status." : "No cases yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
