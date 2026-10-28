import Link from "next/link";
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import {
  getReportCases,
  getUndeliveredCases,
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
import { StatusBadge } from "@/components/StatusBadge";

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

  const [cases, undelivered] = await Promise.all([getReportCases(month), getUndeliveredCases(month)]);
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
            Delivered cases with their price and costs, by the month they were delivered, plus each
            month&apos;s expenses, salaries and net profit. A case&apos;s money only counts once it&apos;s
            delivered.
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
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Delivered</Th>
              <Th sub="Patient">Doctor</Th>
              <Th>Material</Th>
              <Th right sub="+ fees / − deductions">Extras</Th>
              <Th right>Price</Th>
              <Th sub="Fee">Ceramist</Th>
              <Th sub="Fee">Designer</Th>
              <Th sub="Fee">Ibar</Th>
              <Th sub="Cost">Metal</Th>
              <Th right>Photogr. fee</Th>
              <Th sub="Fees">Other roles</Th>
              <Th right>Profit</Th>
              {customFields.map((f) => (
                <Th key={f.id}>{f.label}</Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((c) => (
              <tr key={c.id} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-2.5 py-2 text-slate-500">
                  {new Date(c.deliveredAt ?? c.entryDate).toLocaleDateString("en-GB")}
                </td>
                <td className="min-w-[150px] px-2.5 py-2">
                  <span className="font-semibold text-slate-900">{c.doctor.name}</span>
                  <a href={`/cases/${c.id}`} className="block text-xs text-slate-500 hover:text-brand">
                    {c.patientName}
                  </a>
                </td>
                <td className="px-2.5 py-2 text-slate-600">{caseMaterialsText(c) || "-"}</td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right text-slate-700">
                  {c.extraFee ? <span className="block text-emerald-700">+{fmt(c.extraFee)}</span> : null}
                  {c.deduction ? <span className="block text-rose-700">−{fmt(c.deduction)}</span> : null}
                  {!c.extraFee && !c.deduction ? "-" : null}
                </td>
                <Num value={c.totalPrice} strong />
                <Who name={c.ceramist?.name} amount={c.ceramistFee} />
                <Who name={designerNames(c)} amount={designerFees(c)} />
                <Who name={c.ibarDesigner?.name} amount={c.ibarFee} />
                <Who name={caseMetalsText(c)} amount={c.metalCost} />
                <Num value={c.photogrammetryCost} />
                <Who name={staffText(c)} amount={c.assignments.length ? staffFees(c) : null} />
                <Num value={caseProfit(c)} strong />
                {customFields.map((f) => (
                  <td key={f.id} className="px-2.5 py-2 text-slate-600">
                    {caseFieldText(c, f)}
                  </td>
                ))}
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={12 + customFields.length} className="px-4 py-10 text-center text-slate-400">
                  No cases delivered {month ? "this month" : "yet"}.
                </td>
              </tr>
            )}
          </tbody>
          {cases.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-medium text-slate-900">
              <tr>
                <td colSpan={4} className="px-2.5 py-2.5">
                  Total ({cases.length} case{cases.length === 1 ? "" : "s"})
                </td>
                <Num value={totals.price} strong />
                <Num value={totals.ceramist} />
                <Num value={totals.designer} />
                <Num value={totals.ibar} />
                <Num value={totals.metal} />
                <Num value={totals.photogrammetry} />
                <Num value={totals.staff} />
                <Num value={totals.profit} strong />
                {customFields.map((f) => (
                  <td key={f.id} />
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {undelivered.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Not delivered yet</h2>
          <p className="mb-3 text-sm text-slate-500">
            {undelivered.length} case{undelivered.length === 1 ? "" : "s"} still in progress. Their
            amounts aren&apos;t counted anywhere until they&apos;re marked delivered.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Entered</th>
                  <th className="px-4 py-3 font-medium">Doctor</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Units</th>
                  <th className="px-4 py-3 text-right font-medium">Price (not counted)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {undelivered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                      {new Date(c.entryDate).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-900">{c.doctor.name}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      <a href={`/cases/${c.id}`} className="hover:text-brand">
                        {c.patientName}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{caseUnits(c)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{fmt(c.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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

// Two-line column header: the title, with what's under it in each cell.
function Th({ children, sub, right }: { children: React.ReactNode; sub?: string; right?: boolean }) {
  return (
    <th className={`px-2.5 py-2.5 align-bottom font-medium leading-tight ${right ? "text-right" : ""}`}>
      {children}
      {sub && <span className="block font-normal normal-case tracking-normal text-slate-400">{sub}</span>}
    </th>
  );
}

function Num({ value, strong }: { value: number | null | undefined; strong?: boolean }) {
  return (
    <td className={`whitespace-nowrap px-2.5 py-2 text-right ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>
      {fmt(value)}
    </td>
  );
}

// A person (or metal) with their fee (or cost) under it.
function Who({ name, amount }: { name: string | null | undefined; amount: number | null | undefined }) {
  if (!name && amount == null) return <td className="px-2.5 py-2 text-slate-300">-</td>;
  return (
    <td className="px-2.5 py-2">
      <span className="text-slate-700">{name || "-"}</span>
      <span className="block whitespace-nowrap text-xs font-medium text-slate-900">{fmt(amount)}</span>
    </td>
  );
}
