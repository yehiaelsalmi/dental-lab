import { FileText, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { generateInvoice, deleteInvoice } from "./actions";

function defaultMonth(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", timeZone: "UTC" });
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("page.invoices");
  const { error } = await searchParams;

  const [doctors, invoices] = await Promise.all([
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      orderBy: { periodStart: "desc" },
      include: { doctor: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Invoices</h1>
      <p className="mb-6 text-sm text-slate-500">
        Generate a monthly invoice per doctor from that doctor&apos;s priced cases.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Generate an invoice</h2>
        <form action={generateInvoice} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
            Doctor
            <select
              name="doctorId"
              required
              defaultValue=""
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="" disabled>
                Select doctor
              </option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Month
            <input
              type="month"
              name="month"
              required
              defaultValue={defaultMonth()}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            Generate
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          This isn&apos;t automatic yet — come back here each month (or ask about automating it).
          Only cases with a price set (Material chosen) are included.
        </p>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">Period</th>
              <th className="px-5 py-3 text-right font-medium">Total</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{inv.doctor.name}</td>
                <td className="px-5 py-3 text-slate-600">{monthLabel(inv.periodStart)}</td>
                <td className="px-5 py-3 text-right text-slate-800">{formatEGP(inv.totalAmount)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <a
                      href={`/api/invoices/${inv.id}/pdf`}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover"
                    >
                      <FileText size={14} />
                      PDF
                    </a>
                    <form action={deleteInvoice}>
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  No invoices generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
