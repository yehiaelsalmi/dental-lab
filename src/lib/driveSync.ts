import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";

// Files added to the case folders straight from Google Drive reach the app
// through a small Google Apps Script that runs in the lab's own Google
// account (the app's Drive permission only sees files the app uploaded).
// The script calls /api/drive-sync with this shared secret.
const SECRET_KEY = "drive.syncSecret";
const LAST_SYNC_KEY = "drive.lastSync";

export async function getSyncSecret(): Promise<string> {
  const existing = await getSetting(SECRET_KEY);
  if (existing) return existing;
  const secret = randomBytes(24).toString("hex");
  await setSetting(SECRET_KEY, secret);
  return secret;
}

export async function regenerateSyncSecret(): Promise<void> {
  await setSetting(SECRET_KEY, randomBytes(24).toString("hex"));
}

export async function checkSyncSecret(given: string | null): Promise<boolean> {
  const secret = await getSetting(SECRET_KEY);
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function markSynced() {
  await setSetting(LAST_SYNC_KEY, new Date().toISOString());
}

export async function lastSync(): Promise<Date | null> {
  const value = await getSetting(LAST_SYNC_KEY);
  return value ? new Date(value) : null;
}

export function syncEndpoint(): string {
  const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/drive-sync`;
}

export type SyncedFile = {
  id: string;
  name: string;
  url: string;
  caseFolderId: string;
  folder: string | null;
  createdTime: string;
};

// Adds files the app doesn't know yet to their cases. Files it uploaded
// itself, and files deleted from a case, are already known and skipped.
export async function addSyncedFiles(files: SyncedFile[]): Promise<number> {
  if (files.length === 0) return 0;
  const [known, cases] = await Promise.all([
    prisma.caseFile.findMany({ where: { driveFileId: { in: files.map((f) => f.id) } }, select: { driveFileId: true } }),
    prisma.case.findMany({
      where: { driveFolderId: { in: [...new Set(files.map((f) => f.caseFolderId))] } },
      select: { id: true, driveFolderId: true, status: true },
    }),
  ]);
  const seen = new Set(known.map((k) => k.driveFileId));
  let added = 0;
  for (const f of files) {
    const c = cases.find((x) => x.driveFolderId === f.caseFolderId);
    if (!c || seen.has(f.id)) continue;
    seen.add(f.id);
    const created = new Date(f.createdTime);
    await prisma.caseFile.create({
      data: {
        caseId: c.id,
        type: "DRIVE",
        fileName: String(f.name).slice(0, 255),
        driveFileId: f.id,
        driveLink: f.url,
        folder: f.folder ? String(f.folder).slice(0, 120) : null,
        stage: c.status,
        createdAt: Number.isNaN(created.getTime()) ? new Date() : created,
      },
    });
    added++;
  }
  return added;
}

// The Apps Script the lab pastes into script.google.com (see Drive Settings).
export function appsScript(endpoint: string, secret: string): string {
  return `// Copies files added straight to the case folders in Drive into the case system.
// Paste into script.google.com while signed in to the lab's Google account,
// then run "setup" once and allow access. It then checks every 5 minutes.
const SYSTEM_URL = "${endpoint}";
const SECRET = "${secret}";

function syncCaseFiles() {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  // First run: the last 30 days. Later runs overlap by 10 minutes; the system
  // ignores files it already has.
  const last = Number(props.getProperty("lastRun") || now.getTime() - 30 * 24 * 3600 * 1000);
  const since = new Date(last - 10 * 60 * 1000);

  const res = UrlFetchApp.fetch(SYSTEM_URL, { headers: { "X-Sync-Secret": SECRET }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("The system answered " + res.getResponseCode() + ": " + res.getContentText());
  const caseFolders = new Set(JSON.parse(res.getContentText()).caseFolders);

  const query = "modifiedDate > '" + Utilities.formatDate(since, "UTC", "yyyy-MM-dd'T'HH:mm:ss") +
    "' and trashed = false and mimeType != 'application/vnd.google-apps.folder'";
  const files = DriveApp.searchFiles(query);
  const found = [];
  while (files.hasNext()) {
    const file = files.next();
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (caseFolders.has(parent.getId())) {
        found.push(describe(file, parent.getId(), null));
        continue;
      }
      // One level down: a subfolder such as "scans (for design)".
      const grandParents = parent.getParents();
      while (grandParents.hasNext()) {
        const gp = grandParents.next();
        if (caseFolders.has(gp.getId())) found.push(describe(file, gp.getId(), parent.getName()));
      }
    }
  }

  for (let i = 0; i < found.length; i += 100) {
    const r = UrlFetchApp.fetch(SYSTEM_URL, {
      method: "post",
      contentType: "application/json",
      headers: { "X-Sync-Secret": SECRET },
      payload: JSON.stringify({ files: found.slice(i, i + 100) }),
      muteHttpExceptions: true,
    });
    if (r.getResponseCode() !== 200) throw new Error("The system answered " + r.getResponseCode() + ": " + r.getContentText());
  }
  props.setProperty("lastRun", String(now.getTime()));
}

function describe(file, caseFolderId, folder) {
  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
    caseFolderId: caseFolderId,
    folder: folder,
    createdTime: file.getDateCreated().toISOString(),
  };
}

// Run once: checks now, then every 5 minutes.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("syncCaseFiles").timeBased().everyMinutes(5).create();
  syncCaseFiles();
}
`;
}
