import { requirePermission } from "@/lib/access";
import { WHATSAPP_TEMPLATE_TEXT, getWhatsAppSettings } from "@/lib/whatsapp";
import { getLabSettings } from "@/lib/labSettings";
import { LabMark } from "@/components/LabMark";
import { saveLabSettings, saveWhatsAppAction, testWhatsAppAction } from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function LabSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; waSaved?: string; waError?: string; waTest?: string }>;
}) {
  await requirePermission("page.settings");
  const { error, saved, waSaved, waError, waTest } = await searchParams;
  const whatsapp = await getWhatsAppSettings();
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

      <section className="mt-8 flex flex-col gap-4 rounded-xl border border-emerald-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">WhatsApp notifications</h2>
          <p className="mt-1 text-xs text-slate-500">
            {whatsapp.configured
              ? "Connected: notifications go by WhatsApp (and to the bell in the system); emails are off."
              : "Not connected yet: notifications still go by email. Connect Meta's WhatsApp Business account below to switch."}{" "}
            Each person gets them on the WhatsApp number on their account (Users page or My Account).
          </p>
        </div>
        {waSaved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">WhatsApp settings saved.</p>}
        {waTest && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Test message sent to +{waTest}. Check WhatsApp.</p>}
        {waError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{waError}</p>}

        <details className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium">How to connect (one time)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Get a phone number that is <strong>not</strong> used on the normal WhatsApp app (e.g. a new SIM).</li>
            <li>
              At <strong>business.facebook.com</strong> create a business account, then at <strong>developers.facebook.com</strong>{" "}
              create an app of type <em>Business</em> and add <strong>WhatsApp</strong> to it.
            </li>
            <li>In WhatsApp → API Setup, add and verify that phone number, and add a payment method.</li>
            <li>
              In WhatsApp Manager → Message templates, create a template named <code>case_update</code>, category{" "}
              <strong>Utility</strong>, language <strong>English</strong>, with this body:
              <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-xs ring-1 ring-slate-200">{WHATSAPP_TEMPLATE_TEXT}</pre>
              (example values: Ahmed / New case assigned: Omar Mohamed / https://system.alexandriaaallon4.com/cases). Wait for
              it to be approved.
            </li>
            <li>
              Create a <strong>permanent access token</strong>: Business settings → System users → add an admin system user →
              assign the app (WhatsApp permissions) → Generate token.
            </li>
            <li>Paste the <strong>Phone number ID</strong> (from API Setup) and the token below, save, then send a test.</li>
          </ol>
        </details>

        <form action={saveWhatsAppAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Phone number ID
            <input name="phoneNumberId" defaultValue={whatsapp.phoneNumberId} placeholder="e.g. 123456789012345" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Permanent access token
            <input
              name="token"
              type="password"
              autoComplete="off"
              placeholder={whatsapp.token ? "Saved (leave empty to keep it)" : "Paste the token"}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Template name
            <input name="template" defaultValue={whatsapp.template} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Template language code
            <input name="language" defaultValue={whatsapp.language} className={INPUT} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Save WhatsApp settings
            </button>
            {whatsapp.configured && (
              <button
                type="submit"
                name="disconnect"
                value="1"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Disconnect (back to email)
              </button>
            )}
          </div>
        </form>
        {whatsapp.configured && (
          <form action={testWhatsAppAction}>
            <button type="submit" className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
              Send me a test message
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
