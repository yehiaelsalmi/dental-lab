import Link from "next/link";
import { Plus, Inbox, Search, X, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, caseVisibilityWhere, requireAccess } from "@/lib/access";
import {
} from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { findStatus, getStatuses } from "@/lib/statuses";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { getCaseAlert, STALE_DAYS } from "@/lib/caseAlerts";
import { isBeforeIbar } from "@/lib/caseFlow";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "due", label: "Due date (soonest)" },
  { value: "patient", label: "Patient name (A-Z)" },
  { value: "doctor", label: "Doctor name (A-Z)" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];
const DEFAULT_SORT: SortKey = "newest";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; error?: string }>;
}) {
  const { status: statusParam, q, sort: sortParam, error } = await searchParams;
  const query = (q ?? "").trim();
  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === sortParam)
    ? (sortParam as SortKey)
    : DEFAULT_SORT;
  const access = await requireAccess();
  const { caseScope, visibleStatuses } = access.role;
  const allStatuses = await getStatuses();
  const activeStatus = allStatuses.some((s) => s.key === statusParam) ? statusParam! : null;
  // Status counters only for the statuses this role can see.
  const shownStatuses = allStatuses
    .filter((s) => visibleStatuses.length === 0 || visibleStatuses.includes(s.key))
    .map((s) => s.key);

  const cases = await prisma.case.findMany({
    where: caseVisibilityWhere(access),
    include: { assignedDesigner: true, firstDesigner: true, doctor: true },
    orderBy: { createdAt: "desc" },
  });

  // Matches anywhere in the patient or doctor name, ignoring case.
  const needle = query.toLowerCase();
  const matchingCases = needle
    ? cases.filter(
        (c) =>
          c.patientName.toLowerCase().includes(needle) ||
          c.doctor.name.toLowerCase().includes(needle),
      )
    : cases;

  const counts: Record<string, number> = Object.fromEntries(
    allStatuses.map((s) => [s.key, matchingCases.filter((c) => c.status === s.key).length]),
  );

  const filteredCases = activeStatus
    ? matchingCases.filter((c) => c.status === activeStatus)
    : matchingCases;

  // `cases` is already newest first. Cases without a due date go last.
  const byName = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: "base" });
  const sortedCases = [...filteredCases];
  if (sort === "oldest") sortedCases.reverse();
  if (sort === "due") {
    sortedCases.sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return a.dueDate ? -1 : b.dueDate ? 1 : 0;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }
  if (sort === "patient")
    sortedCases.sort((a, b) => byName(a.patientName, b.patientName));
  if (sort === "doctor")
    sortedCases.sort((a, b) => byName(a.doctor.name, b.doctor.name));

  // Cases due by tomorrow or stuck with a designer go on top, in red; each
  // group keeps the chosen sort order.
  const now = new Date();
  const alerts = new Map(sortedCases.map((c) => [c.id, getCaseAlert(c, now)]));
  const visibleCases = [
    ...sortedCases.filter((c) => alerts.get(c.id)),
    ...sortedCases.filter((c) => !alerts.get(c.id)),
  ];
  const alertCount = visibleCases.filter((c) => alerts.get(c.id)).length;

  const withParams = (params: { status?: string | null; q?: string }) => {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.q) search.set("q", params.q);
    if (sort !== DEFAULT_SORT) search.set("sort", sort);
    const qs = search.toString();
    return qs ? `/cases?${qs}` : "/cases";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
          <p className="mt-1 text-sm text-slate-500">
            {caseScope === "OWN"
              ? "Cases assigned to you"
              : caseScope === "PHOTOGRAMMETRY"
                ? "Cases that need photogrammetry"
                : visibleStatuses.length > 0
                  ? "Cases in your stages"
                  : "All lab cases"}
          </p>
        </div>
        {can(access, "case.create") && (
          <Link
            href="/cases/new"
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            <Plus size={16} />
            New Case
          </Link>
        )}
      </div>

      {error === "forbidden" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your role doesn&apos;t have access to that page. Ask a Lab Leader if you need it.
        </p>
      )}

      <form action="/cases" className="mb-4 flex flex-col gap-2 sm:flex-row">
        {activeStatus && (
          <input type="hidden" name="status" value={activeStatus} />
        )}
        <div className="flex flex-1 gap-2">
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
        </div>
        <AutoSubmitSelect
          name="sort"
          label="Sort cases"
          defaultValue={sort}
          options={[...SORT_OPTIONS]}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </form>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {shownStatuses.map((status) => {
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
              <p
                className={`text-2xl font-semibold ${active ? "text-brand" : "text-slate-900"}`}
              >
                {counts[status]}
              </p>
              <p
                className={`mt-1 text-xs font-medium ${active ? "text-brand" : "text-slate-500"}`}
              >
                {findStatus(allStatuses, status).label}
              </p>
            </Link>
          );
        })}
      </div>

      <p className="mb-4 text-sm text-slate-500">
        {activeStatus || query ? (
          <>
            Showing {visibleCases.length} case
            {visibleCases.length === 1 ? "" : "s"}
            {query && (
              <>
                {" "}
                matching{" "}
                <span className="font-medium text-slate-900">
                  &quot;{query}&quot;
                </span>
              </>
            )}
            {activeStatus && (
              <>
                {" "}
                in{" "}
                <span className="font-medium text-slate-900">
                  {findStatus(allStatuses, activeStatus).label}
                </span>
              </>
            )}
            .{" "}
            <Link
              href="/cases"
              className="font-medium text-brand hover:text-brand-hover"
            >
              Show all
            </Link>
          </>
        ) : (
          "Click a status to see only the cases in it."
        )}
      </p>

      {alertCount > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            {alertCount} case{alertCount === 1 ? " needs" : "s need"} attention:
            due by tomorrow, or no progress from the designer for {STALE_DAYS}+
            days. They&apos;re shown first, in red.
          </span>
        </p>
      )}

      <ul className="flex flex-col gap-3 sm:hidden">
        {visibleCases.map((c) => {
          const alert = alerts.get(c.id);
          return (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className={`block rounded-xl border p-4 ${
                  alert
                    ? "border-rose-300 bg-rose-50 active:bg-rose-100"
                    : "border-slate-200 bg-white active:bg-slate-50"
                }`}
              >
                {alert && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                    <TriangleAlert size={13} />
                    {alert.label}
                  </p>
                )}
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words font-medium text-slate-900">
                    {c.patientName}
                  </p>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{c.doctor.name}</p>
              {c.needsPhotogrammetry && <PhotogrammetryTag done={!!c.photogrammetryDoneAt} />}
                <p className="mt-2 text-xs text-slate-400">
                  {(isBeforeIbar(c) ? c.firstDesigner : c.assignedDesigner)?.name ?? "Unassigned"}
                  {c.dueDate
                    ? ` - Due ${new Date(c.dueDate).toLocaleDateString()}`
                    : ""}
                </p>
              </Link>
            </li>
          );
        })}
        {visibleCases.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
            {query
              ? "No cases match your search."
              : activeStatus
                ? "No cases in this status."
                : "No cases yet."}
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
            {visibleCases.map((c) => {
              const alert = alerts.get(c.id);
              return (
                <tr
                  key={c.id}
                  className={`transition-colors ${
                    alert
                      ? "bg-rose-50 shadow-[inset_4px_0_0_0_#f43f5e] hover:bg-rose-100"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/cases/${c.id}`}
                      className="font-medium text-slate-900 hover:text-brand"
                    >
                      {c.patientName}
                    </Link>
                    {alert && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-700">
                        <TriangleAlert size={12} />
                        {alert.label}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                  {c.doctor.name}
                  {c.needsPhotogrammetry && (
                    <PhotogrammetryTag done={!!c.photogrammetryDoneAt} />
                  )}
                </td>
                  <td className="px-5 py-4 text-slate-500">
                    {(isBeforeIbar(c) ? c.firstDesigner : c.assignedDesigner)?.name ?? (
                      <span className="text-slate-300">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {c.dueDate ? new Date(c.dueDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              );
            })}
            {visibleCases.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-16 text-center text-slate-400"
                >
                  <Inbox className="mx-auto mb-3 text-slate-300" size={28} />
                  {query
                    ? "No cases match your search."
                    : activeStatus
                      ? "No cases in this status."
                      : "No cases yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PhotogrammetryTag({ done }: { done: boolean }) {
  return (
    <span
      className={`mt-1.5 block w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${
        done ? "bg-slate-100 text-slate-500" : "bg-sky-50 text-sky-700"
      }`}
    >
      {done ? "Photogrammetry done" : "Photogrammetry pending"}
    </span>
  );
}
