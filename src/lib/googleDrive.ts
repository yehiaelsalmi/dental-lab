import { google } from "googleapis";
import { Readable } from "node:stream";
import { getSetting, setSetting } from "@/lib/settings";
import { LAB_NAME } from "@/lib/constants";

const FULL_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SCOPES = [FULL_DRIVE_SCOPE];
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

// Connections made before the app needed to see pre-existing folders only
// granted the narrow drive.file scope and must be re-authorized.
export async function hasFullDriveAccess(): Promise<boolean> {
  const scope = await getSetting(GRANTED_SCOPE_SETTING_KEY);
  return !!scope && scope.split(" ").includes(FULL_DRIVE_SCOPE);
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

function parseFolderId(input: string): string | null {
  const trimmed = input.trim();
  const fromPath = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromPath) return fromPath[1];
  const fromQuery = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function setRootFolder(linkOrId: string): Promise<{ id: string; name: string }> {
  const folderId = parseFolderId(linkOrId);
  if (!folderId) throw new Error("That doesn't look like a Google Drive folder link.");

  const drive = await getDriveClient();
  let file;
  try {
    file = await drive.files.get({ fileId: folderId, fields: "id, name, mimeType" });
  } catch (error) {
    throw (
      expiredConnectionError(error) ??
      new Error("Couldn't open that folder. Make sure it's in the Google account connected here.")
    );
  }

  if (file.data.mimeType !== FOLDER_MIME || !file.data.id) {
    throw new Error("That link points to a file, not a folder.");
  }

  await setSetting(ROOT_FOLDER_SETTING_KEY, file.data.id);
  return { id: file.data.id, name: file.data.name ?? "" };
}

export async function getRootFolderInfo(): Promise<{ id: string; name: string; url: string } | null> {
  const folderId = await getSetting(ROOT_FOLDER_SETTING_KEY);
  if (!folderId) return null;

  const drive = await getDriveClient();
  try {
    const file = await drive.files.get({ fileId: folderId, fields: "id, name, webViewLink" });
    return {
      id: folderId,
      name: file.data.name ?? "",
      url: file.data.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`,
    };
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

async function getOrCreateRootFolder(drive: DriveClient): Promise<string> {
  const existing = await getSetting(ROOT_FOLDER_SETTING_KEY);
  if (existing) return existing;

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

export async function listDoctorFolderNames(): Promise<string[]> {
  try {
    const drive = await getDriveClient();
    const rootId = await getOrCreateRootFolder(drive);
    return (await listChildFolders(drive, rootId)).map((f) => f.name.trim());
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

// Main folder -> doctor folder -> patient folder, reusing existing folders by name.
export async function createCaseFolder(
  doctorName: string,
  patientName: string
): Promise<{ id: string; url: string }> {
  try {
    const drive = await getDriveClient();
    const rootId = await getOrCreateRootFolder(drive);
    const doctorFolder = await getOrCreateChildFolder(drive, rootId, doctorName);
    return await getOrCreateChildFolder(drive, doctorFolder.id, patientName);
  } catch (error) {
    throw expiredConnectionError(error) ?? error;
  }
}

export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ id: string; url: string }> {
  try {
    const drive = await getDriveClient();

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
