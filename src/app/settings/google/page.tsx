import { Cloud, CloudOff, FolderOpen, TriangleAlert } from "lucide-react";
import { requireRole } from "@/lib/session";
import { getRootFolderInfo, hasFullDriveAccess, isGoogleDriveConnected } from "@/lib/googleDrive";
import { importDoctorsAction, setRootFolderAction } from "./actions";

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; imported?: string }>;
}) {
  await requireRole("LAB_LEADER");
  const { error, saved, imported } = await searchParams;

  const connected = await isGoogleDriveConnected();
  const fullAccess = connected && (await hasFullDriveAccess());
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
    <div className="mx-auto max-w-xl px-8 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Google Drive Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Files are filed as main folder → doctor folder → patient folder, reusing folders that
        already exist.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Main folder saved.
        </p>
      )}
      {imported !== undefined && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Imported {imported} new doctor{imported === "1" ? "" : "s"} from Drive.
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
            This connection was made with the older, narrower permission and can&apos;t see existing
            folders. Reconnect to grant full Drive access.
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
            The folder that contains one subfolder per doctor. If you don&apos;t set one, the app
            creates a folder named after the lab.
          </p>

          {rootFolder && (
            <a
              href={rootFolder.url}
              target="_blank"
              rel="noreferrer"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
            >
              <FolderOpen size={15} />
              Current: {rootFolder.name}
            </a>
          )}

          <form action={setRootFolderAction} className="flex gap-3">
            <input
              name="folderLink"
              required
              placeholder="Paste the folder's Google Drive link"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Save
            </button>
          </form>

          {rootFolder && (
            <form action={importDoctorsAction} className="mt-5 border-t border-slate-100 pt-5">
              <p className="mb-3 text-xs text-slate-500">
                Add every doctor folder in the main folder to the doctor dropdown, so names match
                exactly.
              </p>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Import doctors from Drive
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
