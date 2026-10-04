import { Cloud, CloudOff, FolderOpen, TriangleAlert } from "lucide-react";
import { requireRole } from "@/lib/session";
import { getRootFolderInfo, hasDriveAccess, isGoogleDriveConnected } from "@/lib/googleDrive";
import { createRootFolderAction } from "./actions";

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireRole("LAB_LEADER");
  const { error, saved } = await searchParams;

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
            automatically with the first case, or you can create it now. Don&apos;t move files into
            it by hand from Drive: the app only sees files uploaded through the app.
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
    </div>
  );
}
