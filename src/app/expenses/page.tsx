import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/access";
import { formatEGP } from "@/lib/money";
import {
  currentMonthKey,
  isMonthKey,
  monthLabel,
  monthStart,
  overheadsForMonth,
} from "@/lib/overheads";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { addExpense, deleteExpense, stopExpense, updateExpense } from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function shiftMonth(key: string, by: number) {
  const d = monthStart(key);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string; saved?: string }>;
}) {
  const access = await requirePermission("page.expenses");
  const params = await searchParams;
  const month = isMonthKey(params.month) ? params.month : currentMonthKey();

  const overheads = await overheadsForMonth(month);
  const rows = await prisma.expense.findMany({ where: { id: { in: overheads.expenses.map((e) => e.id) } } });
  const startOf = (id: string) => rows.find((r) => r.id === id)?.month.toISOString().slice(0, 7);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Expenses</h1>
      <p className="mb-6 text-sm text-slate-500">
        Lab costs that aren&apos;t tied to a case, like rent or supplies. They&apos;re taken off
        that month&apos;s profit in Reports, together with salaries.
      </p>

      <div className="mb-6 flex items-center gap-2">
        <Link href={`/expenses?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50">
          <ChevronLeft size={16} />
        </Link>
        <p className="min-w-40 text-center text-base font-semibold text-slate-900">{monthLabel(month)}</p>
        <Link href={`/expenses?month=${shiftMonth(month, 1)}`} aria-label="Next month" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50">
          <ChevronRight size={16} />
        </Link>
      </div>

      {params.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>}
      {params.saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add an expense to {monthLabel(month)}</h2>
        <form action={addExpense} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto_auto] sm:items-end">
          <input type="hidden" name="month" value={month} />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Name
            <input name="name" required placeholder="e.g. Rent, Resin" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Amount (EGP)
            <input name="amount" type="number" min={0} step="0.01" required className={INPUT} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="recurring" className="h-4 w-4 accent-brand" />
            Repeats every month
          </label>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover">
            Add
          </button>
        </form>
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Expenses this month
        </div>
        <ul className="divide-y divide-slate-100">
          {overheads.expenses.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 px-5 py-3">
              <form action={updateExpense} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="month" value={month} />
                <input name="name" defaultValue={e.name} aria-label="Name" className={`${INPUT} min-w-0 flex-1`} />
                <input name="amount" type="number" min={0} step="0.01" defaultValue={e.amount} aria-label="Amount" className={`${INPUT} w-32`} />
                <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Save
                </button>
              </form>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {e.recurring ? `Every month since ${monthLabel(startOf(e.id) ?? month)}` : "This month only"}
                </span>
                <div className="flex items-center gap-4">
                  {e.recurring && (
                    <form action={stopExpense}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="month" value={month} />
                      <ConfirmSubmitButton
                        message={`Stop "${e.name}" after ${monthLabel(month)}? Earlier months keep it.`}
                        className="font-medium text-slate-600 hover:text-slate-900"
                      >
                        Stop after this month
                      </ConfirmSubmitButton>
                    </form>
                  )}
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="month" value={month} />
                    <ConfirmSubmitButton
                      message={
                        e.recurring
                          ? `Delete "${e.name}" from every month, including past ones?`
                          : `Delete "${e.name}"?`
                      }
                      className="flex items-center gap-1 font-medium text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 size={13} />
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            </li>
          ))}
          {overheads.expenses.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-slate-400">No expenses for this month yet.</li>
          )}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Salaries
          {can(access, "page.users") && (
            <Link href="/users" className="normal-case tracking-normal text-brand hover:text-brand-hover">
              Set salaries on the Users page
            </Link>
          )}
        </div>
        <ul className="divide-y divide-slate-100 text-sm">
          {overheads.salaries.map((s) => (
            <li key={s.id} className="flex justify-between px-5 py-2.5">
              <span className="text-slate-700">{s.name}</span>
              <span className="font-medium text-slate-900">{formatEGP(s.amount)}</span>
            </li>
          ))}
          {overheads.salaries.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-slate-400">No salaries set.</li>
          )}
        </ul>
      </section>

      <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <Total label="Expenses" value={overheads.expenseTotal} />
        <Total label="Salaries" value={overheads.salaryTotal} />
        <Total label="Total" value={overheads.expenseTotal + overheads.salaryTotal} strong />
      </div>
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-brand/30 bg-brand-soft" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{formatEGP(value)}</p>
    </div>
  );
}
