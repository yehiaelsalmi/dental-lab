import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addSyncedFiles, checkSyncSecret, markSynced, type SyncedFile } from "@/lib/driveSync";

// Called by the lab's Google Apps Script (see lib/driveSync.ts), never by a
// browser: it authenticates with the shared secret, not a session.

// The case folders the script should look in.
export async function GET(request: Request) {
  if (!(await checkSyncSecret(request.headers.get("x-sync-secret")))) {
    return NextResponse.json({ error: "Wrong or missing secret" }, { status: 401 });
  }
  const cases = await prisma.case.findMany({
    where: { driveFolderId: { not: null } },
    select: { driveFolderId: true },
  });
  await markSynced();
  return NextResponse.json({ caseFolders: cases.map((c) => c.driveFolderId) });
}

// Files the script found in those folders.
export async function POST(request: Request) {
  if (!(await checkSyncSecret(request.headers.get("x-sync-secret")))) {
    return NextResponse.json({ error: "Wrong or missing secret" }, { status: 401 });
  }
  let files: SyncedFile[];
  try {
    const body = await request.json();
    files = (Array.isArray(body?.files) ? body.files : []).filter(
      (f: Partial<SyncedFile>) =>
        typeof f?.id === "string" &&
        typeof f?.name === "string" &&
        typeof f?.url === "string" &&
        typeof f?.caseFolderId === "string" &&
        /^https:\/\/(drive|docs)\.google\.com\//.test(f.url)
    );
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const added = await addSyncedFiles(files.slice(0, 500));
  await markSynced();
  return NextResponse.json({ added });
}
