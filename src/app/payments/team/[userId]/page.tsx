import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import {
  STAFF_PAYMENT_KINDS,
  type StaffPaymentKind,
  formatPaidAt,
  staffBalances,
  staffCaseEarnings,
  todayKey,
} from "@/lib/payments";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { addStaffPayment, deleteStaffPayment } from "../../actions";
import { BalanceText, INPUT, Notice, Stat } from "../../ui";

export default async function StaffPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  await requirePermission("money.payments");
  const { userId } = await params;
  const [summary] = await staffBalances(userId);
  if (!summary) notFound();

  const [person, payments, earnings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { baseSalary: true } }),
    prisma.staffPayment.findMany({
      where: { userId },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    staffCaseEarnings(userId),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/payments?tab=team" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} />
        Payments
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">{summary.name}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {summary.role}
        {person?.baseSalary ? ` · base salary ${formatEGP(person.baseSalary)} / month` : ""}
      </p>
      <Notice {...await searchParams} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Earned (done)" hint={summary.pending > 0 ? `${formatEGP(summary.pending)} more in progress` : undefined}>
          {formatEGP(summary.earned)}
        </Stat>
        <Stat label="Paid toward fees">{formatEGP(summary.paidFees)}</Stat>
        <Stat label="Balance">
          <BalanceText balance={summary.balance} owing="Owed" ahead="Paid ahead" />
        </Stat>
        <Stat label="Salary / other paid">{formatEGP(summary.paidOther)}</Stat>
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a payment</h2>
        <form action={addStaffPayment} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[130px_150px_200px_1fr_auto] lg:items-end">
          <input type="hidden" name="userId" value={userId} />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Amount (EGP)
            <input name="amount" type="number" min={1} step="0.01" required className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Date
            <input name="paidAt" type="date" required defaultValue={todayKey()} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            For
            <select name="kind" defaultValue="FEES" className={INPUT}>
              {(Object.keys(STAFF_PAYMENT_KINDS) as StaffPaymentKind[]).map((k) => (
                <option key={k} value={k}>
                  {STAFF_PAYMENT_KINDS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Note (optional)
            <input name="note" maxLength={200} placeholder="e.g. Advance, October salary" className={INPUT} />
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
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {STAFF_PAYMENT_KINDS[p.kind as StaffPaymentKind] ?? p.kind}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.note ? `${p.note} · ` : ""}entered by {p.createdBy.name}
                  </p>
                </div>
                <form action={deleteStaffPayment}>
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Earnings on cases</h2>
        {earnings.length === 0 ? (
          <p className="text-sm text-slate-400">No case earnings.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {earnings.flatMap(({ c, items }) =>
              items.map((item) => (
                <li key={`${c.id}-${item.label}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/cases/${c.id}`} className="font-medium text-slate-800 hover:text-brand">
                      {c.patientName}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {item.label} · {c.doctor.name}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <span className={item.done ? "text-slate-900" : "text-slate-400"}>
                    {formatEGP(item.amount)} {item.done ? "" : "(pending)"}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
