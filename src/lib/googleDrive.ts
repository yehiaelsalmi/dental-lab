import { google } from "googleapis";
import { Readable } from "node:stream";
import { getSetting, setSetting } from "@/lib/settings";
import { LAB_NAME } from "@/lib/constants";
import { CASE_SUBFOLDERS, type CaseSubfolder } from "@/lib/caseFolders";

// drive.file only reaches files and folders this app created. Google treats it
// as non-sensitive, so the OAuth app can be published without a paid security
// review and the connection doesn't expire every 7 days. The trade-off: the
// app can't see folders made by hand in Drive, so it always creates its own
// main folder.
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FULL_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SCOPES = [DRIVE_FILE_SCOPE];
const ROOT_FOLDER_SETTING_KEY = "google_drive_root_folder_id";
const REFRESH_TOKEN_SETTING_KEY = "google_refresh_token";
const GRANTED_SCOPE_SETTING_KEY = "google_granted_scope";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForRefreshToken(code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke the app's access at https://myaccount.google.com/permissions and try connecting again."
    );
  }
  await setSetting(REFRESH_TOKEN_SETTING_KEY, tokens.refresh_token);
  await setSetting(GRANTED_SCOPE_SETTING_KEY, tokens.scope ?? "");
}

export async function isGoogleDriveConnected(): Promise<boolean> {
  const token = await getSetting(REFRESH_TOKEN_SETTING_KEY);
  return !!token;
}

export async function hasDriveAccess(): Promise<boolean> {
  const scope = await getSetting(GRANTED_SCOPE_SETTING_KEY);
  if (!scope) return false;
  const granted = scope.split(" ");
  return granted.includes(DRIVE_FILE_SCOPE) || granted.includes(FULL_DRIVE_SCOPE);
}

async function getDriveClient() {
  const refreshToken = await getSetting(REFRESH_TOKEN_SETTING_KEY);
  if (!refreshToken) {
    throw new Error("Google Drive is not connected yet. Connect it from Settings first.");
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth: client });
}

type DriveClient = Awaited<ReturnType<typeof getDriveClient>>;

// Google returns "invalid_grant" when a stored refresh token has expired or
// been revoked — most commonly the 7-day expiry Google applies while an
// OAuth app is still unverified ("Testing" mode). Surface something a
// non-technical user can act on instead of the raw OAuth error code.
function expiredConnectionError(error: unknown): Error | null {
  const data = (error as { response?: { data?: { error?: string } } })?.response?.data;
  const message = error instanceof Error ? error.message : String(error);
  if (data?.error === "invalid_grant" || message.includes("invalid_grant")) {
    return new Error(
      "The Google Drive connection has expired. Go to Drive Settings and click Reconnect Google Drive, then try again."
    );
  }
  return null;
}

export async function getRootFolderInfo(): Promise<{ id: string; name: string; url: string } | null> {
  const folderId = await getSetting(ROOT_FOLDER_SETTING_KEY);
  if (!folderId) return null;

  const drive = await getDriveClient();
  try {
    const file = await drive.files.get({
      fileId: folderId,
      fields: "id, name, webViewLink, trashed",
    });
    if (file.data.trashed) return null;
    return {
      id: folderId,
      name: file.data.name ?? "",
      url: file.data.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw expiredConnectionError(error) ?? error;
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: number; status?: number })?.code === 404 ||
    (error as { status?: number })?.status === 404;
}

// Reuses the saved main folder while the app can still reach it. A folder the
// app didn't create (e.g. one saved under the old full-Drive permission) or one
// that was deleted reads as "not found", so a fresh one is created instead.
async function getOrCreateRootFolder(drive: DriveClient): Promise<string> {
  const existing = await getSetting(ROOT_FOLDER_SETTING_KEY);
  if (existing) {
    try {
      const file = await drive.files.get({ fileId: existing, fields: "id, trashed" });
      if (!file.data.trashed) return existing;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  const folder = await drive.files.create({
    requestBody: { name: `${LAB_NAME} Cases`, mimeType: FOLDER_MIME },
    fields: "id",
  });

  const folderId = folder.data.id;
  if (!folderId) throw new Error("Failed to create the root folder.");

  await setSetting(ROOT_FOLDER_SETTING_KEY, folderId);
  return folderId;
}

async function listChildFolders(
  drive: DriveClient,
  parentId: string
): Promise<{ id: string; name: string }[]> {
  const folders: { id: string; name: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name) folders.push({ id: f.id, name: f.name });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return folders;
}

function normalize(name: string) {
  return name.trim().toLowerCase();
}

async function getOrCreateChildFolder(
  drive: DriveClient,
  parentId: string,
  name: string
): Promise<{ id: string; url: string }> {
  const wanted = normalize(name);
  const match = (await listChildFolders(drive, parentId)).find((f) => normalize(f.name) === wanted);
  if (match) {
    return { id: match.id, url: `https://drive.google.com/drive/folders/${match.id}` };
  }

  const created = await drive.files.create({
    requestBody: { name: name.trim(), mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id, webViewLink",
  });
  if (!created.data.id) throw new Error(`Failed to create the Drive folder "${name}".`);

  return {
    id: created.data.id,
    url: created.data.webViewLink ?? `https://drive.google.com/drive/folders/${created.data.id}`,
  };
}

export async function ensureRootFolder(): Promise<void> {
  try {
    const drive = await getDriveClient();
    await getOrCreateRootFolder(drive);
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

// Main folder -> doctor folder -> patient folder (with its subfolders),
// reusing folders the app already made.
export async function createCaseFolder(
  doctorName: string,
  patientName: string
): Promise<{ id: string; url: string }> {
  try {
    const drive = await getDriveClient();
    const rootId = await getOrCreateRootFolder(drive);
    const doctorFolder = await getOrCreateChildFolder(drive, rootId, doctorName);
    const caseFolder = await getOrCreateChildFolder(drive, doctorFolder.id, patientName);
    await createSubfolders(drive, caseFolder.id);
    return caseFolder;
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

async function createSubfolders(drive: DriveClient, caseFolderId: string) {
  const ids = {} as Record<CaseSubfolder, string>;
  for (const key of Object.keys(CASE_SUBFOLDERS) as CaseSubfolder[]) {
    ids[key] = (await getOrCreateChildFolder(drive, caseFolderId, CASE_SUBFOLDERS[key])).id;
  }
  return ids;
}

// Makes sure a case folder has all its subfolders; returns their ids.
export async function ensureCaseSubfolders(caseFolderId: string): Promise<Record<CaseSubfolder, string>> {
  try {
    return await createSubfolders(await getDriveClient(), caseFolderId);
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

// Moves a file the app uploaded into another folder. Its id and links stay.
export async function moveFileToFolder(fileId: string, folderId: string): Promise<boolean> {
  try {
    const drive = await getDriveClient();
    const file = await drive.files.get({ fileId, fields: "parents" });
    const parents = file.data.parents ?? [];
    if (parents.length === 1 && parents[0] === folderId) return false;
    await drive.files.update({
      fileId,
      addParents: folderId,
      removeParents: parents.filter((p) => p !== folderId).join(","),
      fields: "id",
    });
    return true;
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

// Uploads into the case folder, or into one of its subfolders (created if
// it's missing, e.g. on cases from before subfolders existed).
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  subfolder?: CaseSubfolder
): Promise<{ id: string; url: string }> {
  try {
    const drive = await getDriveClient();
    if (subfolder) folderId = (await getOrCreateChildFolder(drive, folderId, CASE_SUBFOLDERS[subfolder])).id;

    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id, webViewLink",
    });

    if (!file.data.id) throw new Error("Failed to upload file to Drive.");

    return {
      id: file.data.id,
      url: file.data.webViewLink ?? `https://drive.google.com/file/d/${file.data.id}/view`,
    };
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

export async function downloadFileStream(fileId: string): Promise<Readable> {
  try {
    const drive = await getDriveClient();
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
    return res.data as unknown as Readable;
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

// Moves a file to Drive's trash (restorable there for 30 days). Files the app
// can't reach (added in Drive by hand, or already gone) are left alone.
export async function trashDriveFile(fileId: string): Promise<boolean> {
  try {
    const drive = await getDriveClient();
    await drive.files.update({ fileId, requestBody: { trashed: true }, fields: "id" });
    return true;
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 404 || code === 403 || isNotFound(error)) return false;
    throw expiredConnectionError(error) ?? error;
  }
}
