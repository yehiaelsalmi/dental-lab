import { FileSpreadsheet, FileText } from "lucide-react";
import { requireRole } from "@/lib/session";
import { formatEGP } from "@/lib/money";
import { getReportCases, computeTotals, caseUnits, caseProfit, allBreakdowns, BREAKDOWN_LABELS } from "@/lib/reporting";

const fmt = formatEGP;

export default async function ReportsPage() {
  await requireRole("LAB_LEADER");

  const cases = await getReportCases();
  const totals = computeTotals(cases);
  const breakdowns = allBreakdowns(cases);

  return (
    <div className="mx-auto max-w-full px-8 py-10">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every case with the automatically calculated price and costs, like the old sheet.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/reports/export?format=xlsx"
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet size={16} />
            Excel
          </a>
          <a
            href="/api/reports/export?format=pdf"
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <FileText size={16} />
            PDF
          </a>
        </div>
      </div>

      <div className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1600px] text-left text-sm">
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
              <th className="px-4 py-3 text-right font-medium">Profit</th>
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
                  {c.material?.name ?? "-"}
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
                  {c.assignedDesigner?.name ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.designerFee)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {c.ibarDesigner?.name ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.ibarFee)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {c.metalType?.name ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-800">{fmt(c.metalCost)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                  {fmt(caseProfit(c))}
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={17} className="px-4 py-10 text-center text-slate-400">
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
                <td className="px-4 py-3 text-right">{fmt(totals.profit)}</td>
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
