import { formatEGP } from "@/lib/money";

export const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// "Owes 5,000 EGP" / "Credit 2,000 EGP" / "Settled", from the payer's side.
export function BalanceText({
  balance,
  owing,
  ahead,
}: {
  balance: number;
  owing: string;
  ahead: string;
}) {
  if (Math.round(balance) === 0) return <span className="text-slate-500">Settled</span>;
  return balance > 0 ? (
    <span className="font-semibold text-rose-700">
      {owing} {formatEGP(balance)}
    </span>
  ) : (
    <span className="font-semibold text-emerald-700">
      {ahead} {formatEGP(-balance)}
    </span>
  );
}

export function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg text-slate-900">{children}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Notice({ error, saved, deleted }: { error?: string; saved?: string; deleted?: string }) {
  return (
    <>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Payment saved.</p>}
      {deleted && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Payment deleted.</p>}
    </>
  );
}
