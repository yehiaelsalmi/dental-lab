import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { earningsOnCase } from "@/lib/earnings";
import { formatEGP } from "@/lib/money";
import type { CaseStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const access = await requirePermission("money.viewOwn");
  const { month } = await searchParams;
  const me = access.userId;

  const myAccount = await prisma.user.findUnique({ where: { id: me }, select: { baseSalary: true } });
  const cases = await prisma.case.findMany({
    where: {
      OR: [
        { firstDesignerId: me },
        { assignedDesignerId: me },
        { ceramistId: me },
        { photogrammetryDoneById: me },
      ],
    },
    include: { doctor: true },
    orderBy: { entryDate: "desc" },
  });

  const months = [...new Set(cases.map((c) => monthKey(c.entryDate)))];
  const selected = month && months.includes(month) ? month : null;
  const rows = cases
    .filter((c) => !selected || monthKey(c.entryDate) === selected)
    .flatMap((c) => earningsOnCase(c, me).map((item) => ({ c, item })));

  const total = (done: boolean) =>
    rows.filter((r) => r.item.done === done).reduce((sum, r) => sum + (r.item.amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">My earnings</h1>
      <p className="mb-6 text-sm text-slate-500">
        What you earn for your part of each case. &quot;Done&quot; means your part is finished and
        approved; &quot;pending&quot; means it&apos;s still in progress.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <MonthLink href="/earnings" active={!selected} label="All months" />
        {months.map((m) => (
          <MonthLink key={m} href={`/earnings?month=${m}`} active={selected === m} label={monthLabel(m)} />
        ))}
      </div>

      {myAccount?.baseSalary ? (
        <div className="mb-4 rounded-xl border border-brand/30 bg-brand-soft p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">Base salary</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatEGP(myAccount.baseSalary)} <span className="text-sm font-normal text-slate-500">/ month</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Paid monthly, on top of the case fees below.</p>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Done</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatEGP(total(true))}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatEGP(total(false))}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Case</th>
              <th className="px-4 py-3 font-medium">Your part</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ c, item }) => (
              <tr key={`${c.id}-${item.label}`}>
                <td className="px-4 py-3">
                  <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:text-brand">
                    {c.patientName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {c.doctor.name} · {new Date(c.entryDate).toLocaleDateString()}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {item.label}{" "}
                  <span className={item.done ? "text-emerald-700" : "text-slate-400"}>
                    ({item.done ? "done" : "pending"})
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status as CaseStatus} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{formatEGP(item.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  No earnings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
