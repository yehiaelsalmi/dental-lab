import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import { doctorBalances, formatPaidAt, todayKey } from "@/lib/payments";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { addDoctorPayment, deleteDoctorPayment } from "../../actions";
import { BalanceText, INPUT, Notice, Stat } from "../../ui";

export default async function DoctorPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  await requirePermission("money.payments");
  const { id } = await params;
  const [summary] = await doctorBalances(id);
  if (!summary) notFound();

  const [payments, cases] = await Promise.all([
    prisma.doctorPayment.findMany({
      where: { doctorId: id },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.case.findMany({ where: { doctorId: id }, orderBy: { entryDate: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/payments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} />
        Payments
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{summary.name}</h1>
      <Notice {...await searchParams} />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Owed (all cases)"
          hint={summary.unpriced > 0 ? `${summary.unpriced} case${summary.unpriced === 1 ? " has" : "s have"} no price yet` : undefined}
        >
          {formatEGP(summary.owed)}
        </Stat>
        <Stat label="Paid">{formatEGP(summary.paid)}</Stat>
        <Stat label="Balance">
          <BalanceText balance={summary.balance} owing="Owes" ahead="Credit" />
        </Stat>
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a payment</h2>
        <form action={addDoctorPayment} className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_160px_1fr_auto] sm:items-end">
          <input type="hidden" name="doctorId" value={id} />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Amount (EGP)
            <input name="amount" type="number" min={1} step="0.01" required className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Date
            <input name="paidAt" type="date" required defaultValue={todayKey()} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Note (optional)
            <input name="note" maxLength={200} placeholder="e.g. Advance, cash, bank transfer" className={INPUT} />
          </label>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover">
            Add
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-400">No payments yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {formatEGP(p.amount)} <span className="font-normal text-slate-500">· {formatPaidAt(p.paidAt)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.note ? `${p.note} · ` : ""}entered by {p.createdBy.name}
                  </p>
                </div>
                <form action={deleteDoctorPayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmSubmitButton
                    message={`Delete the payment of ${formatEGP(p.amount)} on ${formatPaidAt(p.paidAt)}?`}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </ConfirmSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Cases</h2>
        {cases.length === 0 ? (
          <p className="text-sm text-slate-400">No cases yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {cases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href={`/cases/${c.id}`} className="truncate font-medium text-slate-800 hover:text-brand">
                    {c.patientName}
                  </Link>
                  <span className="text-xs text-slate-400">{new Date(c.entryDate).toLocaleDateString("en-GB")}</span>
                  <StatusBadge status={c.status} />
                </div>
                <span className={c.totalPrice == null ? "text-amber-600" : "text-slate-900"}>
                  {c.totalPrice == null ? "No price" : formatEGP(c.totalPrice)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
