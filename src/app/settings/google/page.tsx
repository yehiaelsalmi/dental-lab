import { Cloud, CloudOff, FolderOpen, TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/access";
import { getRootFolderInfo, hasDriveAccess, isGoogleDriveConnected } from "@/lib/googleDrive";
import { appsScript, getSyncSecret, lastSync, syncEndpoint } from "@/lib/driveSync";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { createRootFolderAction, regenerateSyncSecretAction } from "./actions";

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; secret?: string }>;
}) {
  await requirePermission("page.drive");
  const { error, saved, secret: secretReset } = await searchParams;
  const [syncSecret, syncedAt] = await Promise.all([getSyncSecret(), lastSync()]);
  const script = appsScript(syncEndpoint(), syncSecret);

  const connected = await isGoogleDriveConnected();
  const fullAccess = connected && (await hasDriveAccess());
  const configured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  let rootFolder: Awaited<ReturnType<typeof getRootFolderInfo>> = null;
  if (fullAccess) {
    try {
      rootFolder = await getRootFolderInfo();
    } catch {
      rootFolder = null;
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Google Drive Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Files are filed as main folder → doctor folder → patient folder. The app creates these
        folders itself and can only see folders and files it made, not the rest of the Drive.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Main folder is ready.
        </p>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!configured && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Google OAuth credentials aren&apos;t set up yet. Add GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to the server&apos;s .env file first.
          </p>
        )}

        {connected && !fullAccess && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Google didn&apos;t grant Drive access on the last connection. Reconnect and approve
            access to continue.
          </p>
        )}

        <div className="mb-5 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              fullAccess ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}
          >
            {fullAccess ? <Cloud size={18} /> : <CloudOff size={18} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {fullAccess ? "Connected" : connected ? "Reconnect needed" : "Not connected"}
            </p>
            <p className="text-xs text-slate-500">
              {fullAccess
                ? "Files upload to Drive automatically."
                : "Connect an account to enable uploads."}
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

      {fullAccess && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Main folder</h2>
          <p className="mb-4 text-xs text-slate-500">
            The app&apos;s own folder in Drive, holding one subfolder per doctor. It&apos;s created
            automatically with the first case, or you can create it now. Files added to case
            folders straight from Drive show up through the Google script below.
          </p>

          {rootFolder ? (
            <a
              href={rootFolder.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
            >
              <FolderOpen size={15} />
              Open {rootFolder.name}
            </a>
          ) : (
            <form action={createRootFolderAction}>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Create main folder
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Files added directly in Drive</h2>
        <p className="mb-3 text-xs text-slate-500">
          A small Google script in the lab&apos;s Google account checks the case folders every 5
          minutes and adds files put there straight from Drive to their case (shown as &quot;Added
          in Drive&quot;). Set it up once:
        </p>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>
            Sign in to Google with the account connected above, and open{" "}
            <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="font-medium text-brand hover:text-brand-hover">
              script.google.com → New project
            </a>
            .
          </li>
          <li>Delete what&apos;s in the editor, paste the script below, and press Save.</li>
          <li>
            Pick <strong>setup</strong> in the function list at the top, press <strong>Run</strong>,
            and allow access when Google asks (choose the lab account; if it warns the app isn&apos;t
            verified, click Advanced → Go to the project).
          </li>
        </ol>
        <p className="mb-3 text-sm text-slate-700">
          Last check:{" "}
          <span className="font-medium">
            {syncedAt
              ? syncedAt.toLocaleString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" })
              : "never (not set up yet)"}
          </span>
        </p>
        {secretReset && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            New secret made. Paste the updated script into the Google project to keep it working.
          </p>
        )}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CopyButton text={script} label="Copy script" />
          <form action={regenerateSyncSecretAction}>
            <ConfirmSubmitButton
              message="Make a new secret? The current script stops working until you paste the updated one."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              New secret
            </ConfirmSubmitButton>
          </form>
        </div>
        <textarea
          readOnly
          value={script}
          rows={10}
          aria-label="Google Apps Script"
          className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700"
        />
        <p className="mt-2 text-xs text-slate-500">
          The script contains a secret key: don&apos;t share it outside the lab.
        </p>
      </div>
    </div>
  );
}
