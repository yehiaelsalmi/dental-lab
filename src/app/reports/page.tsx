import Link from "next/link";
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import {
  getReportCases,
  computeTotals,
  caseUnits,
  caseProfit,
  caseMaterialsText,
  caseMetalsText,
  allBreakdowns,
  designerFees,
  designerNames,
  staffFees,
  staffText,
  caseFieldText,
  BREAKDOWN_LABELS,
} from "@/lib/reporting";
import {
  currentMonthKey,
  isMonthKey,
  monthLabel,
  monthStart,
  overheadsForMonth,
} from "@/lib/overheads";
import { activeFields } from "@/lib/customFields";

function shiftMonth(key: string, by: number) {
  const d = monthStart(key);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

const fmt = formatEGP;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requirePermission("page.reports");
  const { month: monthParam } = await searchParams;
  // A single month by default (with its expenses, salaries and net profit);
  // ?month=all shows every case.
  const allTime = monthParam === "all";
  const month = allTime ? undefined : isMonthKey(monthParam) ? monthParam : currentMonthKey();
  const exportQuery = month ? `&month=${month}` : "";

  const cases = await getReportCases(month);
  const customFields = await activeFields();
  const overheads = month ? await overheadsForMonth(month) : null;
  const totals = computeTotals(cases);
  const breakdowns = allBreakdowns(cases);

  return (
    <div className="mx-auto max-w-full px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every case with its price and costs, plus each month&apos;s expenses, salaries and net
            profit, like the old sheet.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/reports/export?format=xlsx${exportQuery}`}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet size={16} />
            Excel
          </a>
          <a
            href={`/api/reports/export?format=pdf${exportQuery}`}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <FileText size={16} />
            PDF
          </a>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {month ? (
          <>
            <Link href={`/reports?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </Link>
            <p className="min-w-40 text-center text-base font-semibold text-slate-900">{monthLabel(month)}</p>
            <Link href={`/reports?month=${shiftMonth(month, 1)}`} aria-label="Next month" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50">
              <ChevronRight size={16} />
            </Link>
            <Link href="/reports?month=all" className="ml-2 text-sm font-medium text-brand hover:text-brand-hover">
              All time
            </Link>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-slate-900">All time</p>
            <Link href="/reports" className="ml-2 text-sm font-medium text-brand hover:text-brand-hover">
              Back to monthly view
            </Link>
          </>
        )}
      </div>

      {overheads && (
        <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <Stat label="Case profit" value={totals.profit} />
            <Stat label="Expenses" value={-overheads.expenseTotal} />
            <Stat label="Salaries" value={-overheads.salaryTotal} />
            <Stat
              label="Net profit"
              value={totals.profit - overheads.expenseTotal - overheads.salaryTotal}
              strong
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              Expenses and salaries this month
            </div>
            <ul className="divide-y divide-slate-100">
              {overheads.expenses.map((e) => (
                <li key={e.id} className="flex justify-between px-4 py-2">
                  <span className="text-slate-700">
                    {e.name}
                    {e.recurring && <span className="text-slate-400"> (monthly)</span>}
                  </span>
                  <span className="font-medium text-slate-900">{fmt(e.amount)}</span>
                </li>
              ))}
              {overheads.salaries.map((p) => (
                <li key={p.id} className="flex justify-between px-4 py-2">
                  <span className="text-slate-700">Salary: {p.name}</span>
                  <span className="font-medium text-slate-900">{fmt(p.amount)}</span>
                </li>
              ))}
              {overheads.expenses.length + overheads.salaries.length === 0 && (
                <li className="px-4 py-4 text-center text-slate-400">None for this month.</li>
              )}
            </ul>
          </div>
        </section>
      )}

      <div className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[2080px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Doctor</th>
              <th className="px-4 py-3 font-medium">Material</th>
              <th className="px-4 py-3 text-right font-medium">Units</th>
              <th className="px-4 py-3 text-right font-medium">Extra fees</th>
              <th className="px-4 py-3 text-right font-medium">Deduction</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Ceramist</th>
              <th className="px-4 py-3 text-right font-medium">Ceramist fee</th>
              <th className="px-4 py-3 font-medium">Designer</th>
              <th className="px-4 py-3 text-right font-medium">Designer fee</th>
              <th className="px-4 py-3 font-medium">Ibar</th>
              <th className="px-4 py-3 text-right font-medium">Ibar fee</th>
              <th className="px-4 py-3 font-medium">Metal</th>
              <th className="px-4 py-3 text-right font-medium">Metal cost</th>
              <th className="px-4 py-3 text-right font-medium">Milling cost</th>
              <th className="px-4 py-3 text-right font-medium">Photogrammetry cost</th>
              <th className="px-4 py-3 font-medium">Other roles</th>
              <th className="px-4 py-3 text-right font-medium">Fees</th>
              <th className="px-4 py-3 text-right font-medium">Profit</th>
              {customFields.map((f) => (
                <th key={f.id} className="px-4 py-3 font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                  {new Date(c.entryDate).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                  <a href={`/cases/${c.id}`} className="hover:text-brand">
                    {c.patientName}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.doctor.name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {caseMaterialsText(c) || "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-600">{caseUnits(c)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.extraFee)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.deduction)}</td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.totalPrice)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {c.ceramist?.name ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.ceramistFee)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {designerNames(c) || "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(designerFees(c))}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {c.ibarDesigner?.name ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.ibarFee)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {caseMetalsText(c) || "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.metalCost)}</td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.millingCost)}</td>
                <td className="px-4 py-2.5 text-right text-slate-800">
                  {fmt(c.photogrammetryCost)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{staffText(c) || "-"}</td>
                <td className="px-4 py-2.5 text-right text-slate-800">
                  {c.assignments.length ? fmt(staffFees(c)) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                  {fmt(caseProfit(c))}
                </td>
                {customFields.map((f) => (
                  <td key={f.id} className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {caseFieldText(c, f)}
                  </td>
                ))}
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={21 + customFields.length} className="px-4 py-10 text-center text-slate-400">
                  No cases yet.
                </td>
              </tr>
            )}
          </tbody>
          {cases.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-medium text-slate-900">
              <tr>
                <td colSpan={7} className="px-4 py-3">
                  Total
                </td>
                <td className="px-4 py-3 text-right">{fmt(totals.price)}</td>
                <td />
                <td className="px-4 py-3 text-right">{fmt(totals.ceramist)}</td>
                <td />
                <td className="px-4 py-3 text-right">{fmt(totals.designer)}</td>
                <td />
                <td className="px-4 py-3 text-right">{fmt(totals.ibar)}</td>
                <td />
                <td className="px-4 py-3 text-right">{fmt(totals.metal)}</td>
                <td className="px-4 py-3 text-right">{fmt(totals.milling)}</td>
                <td className="px-4 py-3 text-right">{fmt(totals.photogrammetry)}</td>
                <td />
                <td className="px-4 py-3 text-right">{fmt(totals.staff)}</td>
                <td className="px-4 py-3 text-right">{fmt(totals.profit)}</td>
                {customFields.map((f) => (
                  <td key={f.id} />
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">By person</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(breakdowns) as (keyof typeof breakdowns)[]).map((key) => (
          <div key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              {BREAKDOWN_LABELS[key]}
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {breakdowns[key].map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-800">
                    {p.name} <span className="text-slate-400">({p.count})</span>
                  </span>
                  <span className="font-medium text-slate-900">{fmt(p.amount)}</span>
                </li>
              ))}
              {breakdowns[key].length === 0 && (
                <li className="px-4 py-4 text-center text-slate-400">None yet.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-brand/30 bg-brand-soft" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${value < 0 && !strong ? "text-rose-600" : "text-slate-900"}`}>
        {fmt(value)}
      </p>
    </div>
  );
}
