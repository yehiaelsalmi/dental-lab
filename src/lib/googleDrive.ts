import { google } from "googleapis";
import { getSetting, setSetting } from "@/lib/settings";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const ROOT_FOLDER_SETTING_KEY = "google_drive_root_folder_id";
const REFRESH_TOKEN_SETTING_KEY = "google_refresh_token";

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
}

export async function isGoogleDriveConnected(): Promise<boolean> {
  const token = await getSetting(REFRESH_TOKEN_SETTING_KEY);
  return !!token;
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

async function getOrCreateRootFolder(): Promise<string> {
  const existing = await getSetting(ROOT_FOLDER_SETTING_KEY);
  if (existing) return existing;

  const drive = await getDriveClient();
  const folder = await drive.files.create({
    requestBody: {
      name: "Dental Lab Cases",
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  const folderId = folder.data.id;
  if (!folderId) throw new Error("Failed to create the Dental Lab Cases root folder.");

  await setSetting(ROOT_FOLDER_SETTING_KEY, folderId);
  return folderId;
}

export async function createCaseFolder(caseLabel: string): Promise<{ id: string; url: string }> {
  const drive = await getDriveClient();
  const rootFolderId = await getOrCreateRootFolder();

  const folder = await drive.files.create({
    requestBody: {
      name: caseLabel,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id, webViewLink",
  });

  if (!folder.data.id) throw new Error("Failed to create the case's Drive folder.");

  return {
    id: folder.data.id,
    url: folder.data.webViewLink ?? `https://drive.google.com/drive/folders/${folder.data.id}`,
  };
}

export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ id: string; url: string }> {
  const drive = await getDriveClient();

  const { Readable } = await import("node:stream");

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
}
