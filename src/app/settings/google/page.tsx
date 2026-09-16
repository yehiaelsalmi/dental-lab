import { Cloud, CloudOff, TriangleAlert } from "lucide-react";
import { requireRole } from "@/lib/session";
import { isGoogleDriveConnected } from "@/lib/googleDrive";

export default async function GoogleSettingsPage() {
  await requireRole("LAB_LEADER");

  const connected = await isGoogleDriveConnected();
  const configured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  return (
    <div className="mx-auto max-w-xl px-8 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Google Drive Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Scans and design files are uploaded to a Dental Lab Cases folder in your Google Drive.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!configured && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Google OAuth credentials aren&apos;t set up yet. Add GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to the server&apos;s .env file first.
          </p>
        )}

        <div className="mb-5 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}
          >
            {connected ? <Cloud size={18} /> : <CloudOff size={18} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {connected ? "Connected" : "Not connected"}
            </p>
            <p className="text-xs text-slate-500">
              {connected ? "Files upload to Drive automatically." : "Connect an account to enable uploads."}
            </p>
          </div>
        </div>

        {configured && (
          <a
            href="/api/google/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            {connected ? "Reconnect Google Drive" : "Connect Google Drive"}
          </a>
        )}
      </div>
    </div>
  );
}
