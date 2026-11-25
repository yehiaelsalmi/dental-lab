import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { STAFF_PAYMENT_KINDS, doctorBalances, formatPaidAt, staffBalances, type StaffPaymentKind } from "@/lib/payments";
import { currentMonthKey, isMonthKey, monthLabel, monthStart, nextMonthStart } from "@/lib/overheads";
import { BalanceText } from "./ui";

function shiftMonth(key: string, by: number) {
  const d = monthStart(key);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string }> }) {
  await requirePermission("money.payments");
  const params = await searchParams;
  const tab = params.tab === "team" ? "team" : "doctors";
  // All time by default; ?month=YYYY-MM shows one month.
  const month = isMonthKey(params.month) ? params.month : undefined;
  const href = (t: string, m?: string) => {
    const q = new URLSearchParams();
    if (t === "team") q.set("tab", "team");
    if (m) q.set("month", m);
    const qs = q.toString();
    return qs ? `/payments?${qs}` : "/payments";
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Payments</h1>
      <p className="mb-6 text-sm text-slate-500">
        Money received from doctors and paid to the team, entered by hand. Open a doctor or a
        person to add a payment.
      </p>

      <div className="mb-6 flex gap-2">
        {(["doctors", "team"] as const).map((t) => (
          <Link
            key={t}
            href={href(t, month)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t === "team" ? "Team" : "Doctors"}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {month ? (
          <>
            <Link href={href(tab, shiftMonth(month, -1))} aria-label="Previous month" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </Link>
            <p className="min-w-40 text-center text-base font-semibold text-slate-900">{monthLabel(month)}</p>
            <Link href={href(tab, shiftMonth(month, 1))} aria-label="Next month" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50">
              <ChevronRight size={16} />
            </Link>
            <Link href={href(tab)} className="ml-2 text-sm font-medium text-brand hover:text-brand-hover">
              All time
            </Link>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-slate-900">All time</p>
            <Link href={href(tab, currentMonthKey())} className="ml-2 text-sm font-medium text-brand hover:text-brand-hover">
              Filter by month
            </Link>
          </>
        )}
      </div>

      {tab === "doctors" ? (
        month ? <DoctorsMonth month={month} /> : <DoctorsTable />
      ) : month ? (
        <TeamMonth month={month} />
      ) : (
        <TeamTable />
      )}
    </div>
  );
}

async function DoctorsTable() {
  const rows = (await doctorBalances()).filter((d) => d.cases > 0 || d.paid > 0);
  const totalBalance = rows.reduce((s, d) => s + d.balance, 0);
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">
        Owed is the price of their delivered cases; cases still in progress aren&apos;t counted yet.
        In total, doctors{" "}
        <BalanceText balance={totalBalance} owing="owe" ahead="have a credit of" />.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Doctor</th>
              <th className="px-4 py-3 text-right font-medium">Cases</th>
              <th className="px-4 py-3 text-right font-medium">Owed</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/payments/doctors/${d.id}`} className="font-medium text-brand hover:text-brand-hover">
                    {d.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{d.cases}</td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(d.owed)}</td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(d.paid)}</td>
                <td className="px-4 py-3 text-right">
                  <BalanceText balance={d.balance} owing="Owes" ahead="Credit" />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No doctors with cases yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function TeamTable() {
  const rows = (await staffBalances()).filter(
    (u) => u.earned + u.pending + u.paidFees + u.paidOther > 0 || u.active
  );
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">
        Earned is their fees on cases where their part is done; pending is still in progress.
        The balance compares earned with payments toward case fees. Salary and other payments
        are listed separately.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 text-right font-medium">Earned</th>
              <th className="px-4 py-3 text-right font-medium">Pending</th>
              <th className="px-4 py-3 text-right font-medium">Paid (fees)</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
              <th className="px-4 py-3 text-right font-medium">Salary / other</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/payments/team/${u.id}`} className="font-medium text-brand hover:text-brand-hover">
                    {u.name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-400">
                    {u.role}
                    {!u.active && " · removed or disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(u.earned)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{formatEGP(u.pending)}</td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(u.paidFees)}</td>
                <td className="px-4 py-3 text-right">
                  <BalanceText balance={u.balance} owing="Owed" ahead="Paid ahead" />
                </td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(u.paidOther)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const TH = "px-4 py-3 font-medium";

// One month for doctors: cases delivered that month (what became owed) and
// payments received that month, next to each doctor's overall balance.
async function DoctorsMonth({ month }: { month: string }) {
  const range = { gte: monthStart(month), lt: nextMonthStart(month) };
  const [balances, delivered, payments] = await Promise.all([
    doctorBalances(),
    prisma.case.groupBy({ by: ["doctorId"], where: { status: "DELIVERED", deliveredAt: range }, _sum: { totalPrice: true }, _count: { _all: true } }),
    prisma.doctorPayment.findMany({ where: { paidAt: range }, include: { doctor: { select: { name: true } } }, orderBy: { paidAt: "asc" } }),
  ]);
  const rows = balances
    .map((d) => {
      const del = delivered.find((x) => x.doctorId === d.id);
      const paid = payments.filter((p) => p.doctorId === d.id).reduce((s, p) => s + p.amount, 0);
      return { ...d, monthCases: del?._count._all ?? 0, monthOwed: del?._sum.totalPrice ?? 0, monthPaid: paid };
    })
    .filter((d) => d.monthCases > 0 || d.monthPaid > 0);
  const totalOwed = rows.reduce((s, d) => s + d.monthOwed, 0);
  const totalPaid = rows.reduce((s, d) => s + d.monthPaid, 0);
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MonthStat label={`Delivered in ${monthLabel(month)}`} value={totalOwed} hint="price of cases delivered this month" />
        <MonthStat
          label={`Received in ${monthLabel(month)}`}
          value={totalPaid}
          hint={`${payments.length} payment${payments.length === 1 ? "" : "s"}`}
          strong
        />
      </div>
      <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className={TH}>Doctor</th>
              <th className={`${TH} text-right`}>Delivered</th>
              <th className={`${TH} text-right`}>Value</th>
              <th className={`${TH} text-right`}>Paid this month</th>
              <th className={`${TH} text-right`}>Overall balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/payments/doctors/${d.id}`} className="font-medium text-brand hover:text-brand-hover">
                    {d.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{d.monthCases}</td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(d.monthOwed)}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{formatEGP(d.monthPaid)}</td>
                <td className="px-4 py-3 text-right">
                  <BalanceText balance={d.balance} owing="Owes" ahead="Credit" />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nothing delivered or paid this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaymentList
        title={`Payments received in ${monthLabel(month)}`}
        items={payments.map((p) => ({
          id: p.id,
          date: p.paidAt,
          who: p.doctor.name,
          href: `/payments/doctors/${p.doctorId}`,
          amount: p.amount,
          method: p.method,
          note: p.note,
        }))}
      />
    </>
  );
}

// One month for the team: what was paid to each person that month, next to
// their overall balance.
async function TeamMonth({ month }: { month: string }) {
  const range = { gte: monthStart(month), lt: nextMonthStart(month) };
  const [balances, payments] = await Promise.all([
    staffBalances(),
    prisma.staffPayment.findMany({ where: { paidAt: range }, include: { user: { select: { name: true } } }, orderBy: { paidAt: "asc" } }),
  ]);
  const rows = balances
    .map((u) => {
      const mine = payments.filter((p) => p.userId === u.id);
      const sum = (kind: StaffPaymentKind) => mine.filter((p) => p.kind === kind).reduce((s, p) => s + p.amount, 0);
      return { ...u, monthFees: sum("FEES"), monthOther: sum("SALARY") };
    })
    .filter((u) => u.monthFees + u.monthOther > 0);
  const totalFees = rows.reduce((s, u) => s + u.monthFees, 0);
  const totalOther = rows.reduce((s, u) => s + u.monthOther, 0);
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MonthStat label="Paid toward case fees" value={totalFees} />
        <MonthStat label="Salary / other" value={totalOther} />
        <MonthStat
          label={`Total paid in ${monthLabel(month)}`}
          value={totalFees + totalOther}
          hint={`${payments.length} payment${payments.length === 1 ? "" : "s"}`}
          strong
        />
      </div>
      <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className={TH}>Person</th>
              <th className={`${TH} text-right`}>Toward fees</th>
              <th className={`${TH} text-right`}>Salary / other</th>
              <th className={`${TH} text-right`}>Total</th>
              <th className={`${TH} text-right`}>Overall balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/payments/team/${u.id}`} className="font-medium text-brand hover:text-brand-hover">
                    {u.name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-400">{u.role}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(u.monthFees)}</td>
                <td className="px-4 py-3 text-right text-slate-800">{formatEGP(u.monthOther)}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{formatEGP(u.monthFees + u.monthOther)}</td>
                <td className="px-4 py-3 text-right">
                  <BalanceText balance={u.balance} owing="Owed" ahead="Paid ahead" />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No payments to the team this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaymentList
        title={`Payments to the team in ${monthLabel(month)}`}
        items={payments.map((p) => ({
          id: p.id,
          date: p.paidAt,
          who: p.user.name,
          href: `/payments/team/${p.userId}`,
          amount: p.amount,
          method: p.method,
          note: [STAFF_PAYMENT_KINDS[p.kind as StaffPaymentKind] ?? p.kind, p.note].filter(Boolean).join(" · "),
        }))}
      />
    </>
  );
}

function MonthStat({ label, value, hint, strong }: { label: string; value: number; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-brand bg-brand text-white shadow-sm" : "border-slate-200 bg-white"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${strong ? "text-teal-100" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${strong ? "text-white" : "text-slate-900"}`}>{formatEGP(value)}</p>
      {hint && <p className={`mt-0.5 text-xs ${strong ? "text-teal-100" : "text-slate-400"}`}>{hint}</p>}
    </div>
  );
}

function PaymentList({
  title,
  items,
}: {
  title: string;
  items: { id: string; date: Date; who: string; href: string; amount: number; method: string | null; note: string | null }[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">None.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <Link href={p.href} className="font-medium text-slate-900 hover:text-brand">
                  {p.who}
                </Link>
                <p className="text-xs text-slate-500">
                  {formatPaidAt(p.date)}
                  {p.method ? ` · ${p.method}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-slate-900">{formatEGP(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
