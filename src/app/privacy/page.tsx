import Link from "next/link";
import type { Metadata } from "next";
import { LAB_INITIALS, LAB_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Privacy Policy - ${LAB_NAME}`,
};

const CONTACT_EMAIL = "alexallonfourlab@gmail.com";
const LAST_UPDATED = "5 October 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">
          {LAB_INITIALS}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{LAB_NAME}</p>
          <p className="text-xs text-slate-500">Case management system</p>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Privacy Policy</h1>
      <p className="mb-8 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <div className="flex flex-col gap-7 text-sm leading-relaxed text-slate-700">
        <Section title="Who this applies to">
          <p>
            This system is the internal case management tool of {LAB_NAME}. It is used only by the
            lab&apos;s own staff, whose accounts are created by the lab. There is no public sign-up.
          </p>
        </Section>

        <Section title="What information we store">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-medium text-slate-900">Staff accounts:</span> name, email
              address, role, and a securely hashed password.
            </li>
            <li>
              <span className="font-medium text-slate-900">Case details:</span> the doctor&apos;s
              name, the patient&apos;s name, the work requested (units, material, shade, dates and
              notes), the case status and who worked on it.
            </li>
            <li>
              <span className="font-medium text-slate-900">Pricing and invoices:</span> prices and
              fees for each case and the monthly invoices issued to doctors.
            </li>
            <li>
              <span className="font-medium text-slate-900">Files:</span> scans and design files are
              stored in the lab&apos;s own Google Drive, not on our server.
            </li>
          </ul>
        </Section>

        <Section title="How we use Google account data">
          <p className="mb-3">The system uses Google in two ways:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-medium text-slate-900">Sign in with Google:</span> we read your
              name and email address only to match you to the staff account the lab created for
              you.
            </li>
            <li>
              <span className="font-medium text-slate-900">Google Drive:</span> the lab connects
              its own Google Drive so case files can be uploaded and downloaded. The system can
              only see and manage the files and folders it created itself. It cannot see anything
              else in the Drive.
            </li>
          </ul>
          <p className="mt-3">
            Our use of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand hover:text-brand-hover"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Google data is used only to run the features
            described here. It is never sold, never used for advertising, and never shared with
            anyone outside the lab.
          </p>
        </Section>

        <Section title="Emails">
          <p>
            The system sends staff email notifications about their cases (for example, when a case
            is assigned to them or submitted for review). These are sent only to staff accounts.
          </p>
        </Section>

        <Section title="Sharing">
          <p>
            We do not sell or rent any information. Case information is visible only to the
            lab&apos;s staff, according to their role. Invoices are shared with the doctor they
            are addressed to.
          </p>
        </Section>

        <Section title="Security and retention">
          <p>
            The system is served over an encrypted connection, passwords are stored hashed, and
            access requires a staff account. Information is kept for as long as the lab needs it
            for its records. The lab can disconnect Google Drive at any time from Drive Settings,
            or from{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand hover:text-brand-hover"
            >
              Google account permissions
            </a>
            .
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For questions about this policy or to ask for information to be corrected or removed,
            email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand hover:text-brand-hover">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>

      <div className="mt-10 border-t border-slate-200 pt-6">
        <Link href="/login" className="text-sm font-medium text-brand hover:text-brand-hover">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
