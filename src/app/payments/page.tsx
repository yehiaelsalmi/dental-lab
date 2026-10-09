import Link from "next/link";
import { requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import { doctorBalances, staffBalances } from "@/lib/payments";
import { BalanceText } from "./ui";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("money.payments");
  const tab = (await searchParams).tab === "team" ? "team" : "doctors";

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
            href={t === "team" ? "/payments?tab=team" : "/payments"}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t === "team" ? "Team" : "Doctors"}
          </Link>
        ))}
      </div>

      {tab === "doctors" ? <DoctorsTable /> : <TeamTable />}
    </div>
  );
}

async function DoctorsTable() {
  const rows = (await doctorBalances()).filter((d) => d.cases > 0 || d.paid > 0);
  const totalBalance = rows.reduce((s, d) => s + d.balance, 0);
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">
        Owed is the price of all their cases. In total, doctors{" "}
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
