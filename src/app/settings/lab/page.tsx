import { requirePermission } from "@/lib/access";
import { getLabSettings } from "@/lib/labSettings";
import { LabMark } from "@/components/LabMark";
import { getMoneyStartMonth } from "@/lib/moneyStart";
import { currentMonthKey, monthLabel } from "@/lib/overheads";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { saveLabSettings, setMoneyStartAction } from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function LabSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; moneyStart?: string }>;
}) {
  await requirePermission("page.settings");
  const { error, saved, moneyStart: moneyStartSaved } = await searchParams;
  const moneyStart = await getMoneyStartMonth();
  const nextMonth = (() => {
    const [y, m] = currentMonthKey().split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  })();
  const lab = await getLabSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Lab settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        The lab&apos;s name and logo (sidebar, login page, labels, invoices and reports), invoice
        details and alert timings.
      </p>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Settings saved.</p>
      )}

      <form action={saveLabSettings} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Lab</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Lab name
            <input name="name" required defaultValue={lab.name} className={INPUT} />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <LabMark lab={lab} size={56} />
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
              Logo (PNG or JPG, under 1 MB)
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg"
                className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
              />
            </label>
          </div>
          {lab.logoDataUrl && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="removeLogo" className="h-4 w-4 accent-brand" />
              Remove the logo (use the initials instead)
            </label>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Invoice details</h2>
            <p className="text-xs text-slate-500">Printed on every invoice PDF. Leave any of them empty to hide it.</p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Address
            <textarea name="invoiceAddress" rows={2} defaultValue={lab.invoiceAddress} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Phone
            <input name="invoicePhone" defaultValue={lab.invoicePhone} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Payment details
            <textarea
              name="invoicePayment"
              rows={3}
              defaultValue={lab.invoicePayment}
              placeholder="e.g. Bank, account number, InstaPay or Vodafone Cash number"
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Footer note
            <textarea
              name="invoiceFooter"
              rows={2}
              defaultValue={lab.invoiceFooter}
              placeholder="e.g. Thank you for your business. Payment due within 30 days."
              className={INPUT}
            />
          </label>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-slate-900 sm:col-span-2">Case alerts (shown in red on the Cases list)</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            &quot;Forgotten&quot; after (days)
            <input name="staleDays" type="number" min={1} step={1} required defaultValue={lab.staleDays} className={INPUT} />
            <span className="text-xs font-normal text-slate-500">
              A case with a designer and no progress for this many days.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            &quot;Due soon&quot; within (days)
            <input name="dueSoonDays" type="number" min={0} step={1} required defaultValue={lab.dueSoonDays} className={INPUT} />
            <span className="text-xs font-normal text-slate-500">
              1 = due tomorrow, 0 = only due today. Overdue cases are always shown.
            </span>
          </label>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Payment methods</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            One per line
            <textarea
              name="paymentMethods"
              rows={5}
              defaultValue={lab.paymentMethods.join("\n")}
              className={INPUT}
            />
            <span className="text-xs font-normal text-slate-500">
              The choices for &quot;Method&quot; when adding a payment on the Payments page. Removing
              one doesn&apos;t change payments already saved with it.
            </span>
          </label>
        </section>

        <button
          type="submit"
          className="self-start rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover"
        >
          Save settings
        </button>
      </form>

      <section id="money-start" className="mt-8 flex scroll-mt-6 flex-col gap-4 rounded-xl border border-amber-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Count money from</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start the costs and reports afresh: Reports, payment balances and earnings then ignore cases delivered, payments
            made and expenses/salaries before this month. Nothing is deleted; &quot;Count everything again&quot; brings it all back.
          </p>
        </div>
        {moneyStartSaved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}
        <p className="text-sm text-slate-700">
          Now:{" "}
          <span className="font-semibold text-slate-900">
            {moneyStart ? `counting from ${monthLabel(moneyStart)}` : "counting everything (no start month)"}
          </span>
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <form action={setMoneyStartAction}>
            <input type="hidden" name="mode" value="next" />
            <ConfirmSubmitButton
              message={`Start counting money from ${monthLabel(nextMonth)}? Reports, balances and earnings will ignore everything before it (nothing is deleted).`}
              className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              Reset from next month ({monthLabel(nextMonth)})
            </ConfirmSubmitButton>
          </form>
          <form action={setMoneyStartAction} className="flex items-end gap-2">
            <input type="hidden" name="mode" value="month" />
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Or pick a month
              <input type="month" name="month" required defaultValue={moneyStart ?? nextMonth} className={INPUT} />
            </label>
            <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Set
            </button>
          </form>
          {moneyStart && (
            <form action={setMoneyStartAction}>
              <input type="hidden" name="mode" value="clear" />
              <button type="submit" className="px-2 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900">
                Count everything again
              </button>
            </form>
          )}
        </div>
      </section>

    </div>
  );
}
