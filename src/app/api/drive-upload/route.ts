import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VISIBILITY_INCLUDE, can, canViewCase, getAccess } from "@/lib/access";
import type { Permission } from "@/lib/permissions";
import { caseUploadFolder, createDirectUpload } from "@/lib/googleDrive";
import { designSubfolder, isCaseSubfolder, uploadSubfolder, type CaseSubfolder } from "@/lib/caseFolders";

// What an upload is for: who may do it, and which case subfolder it goes to.
const PURPOSES: Record<string, Permission> = {
  newCaseScan: "case.create",
  design: "work.design",
  tryInScans: "case.tryIn",
  ibar: "case.ibar",
  matching: "case.matching",
  photogrammetry: "case.photogrammetry",
  work: "work.upload",
  upload: "case.upload",
};

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Gives the browser a one-time link to upload one file straight to the right
// case folder in Drive (resumable, in pieces). The form then sends only the
// Drive file id, and the server checks it's in that case's folder.
export async function POST(request: Request) {
  const access = await getAccess();
  if (!access) return fail("Please sign in again.", 401);
  const body = await request.json().catch(() => null);
  const purpose = String(body?.purpose ?? "");
  const permission = PURPOSES[purpose];
  if (!permission || !can(access, permission)) return fail("You're not allowed to upload this.", 403);

  const name = String(body?.name ?? "").trim().slice(0, 250);
  const size = Number(body?.size);
  if (!name || !Number.isFinite(size) || size <= 0) return fail("Pick a file first.");

  let folderId: string;
  try {
    if (purpose === "newCaseScan") {
      // The scan follows the case being created from the same form: wait for
      // it (so only one patient folder is ever made), then use its folder.
      const patientName = String(body?.patientName ?? "").trim();
      if (!patientName) return fail("Fill in the patient first.");
      let created = null;
      for (let i = 0; i < 30 && !created; i++) {
        created = await prisma.case.findFirst({
          where: {
            patientName,
            createdById: access.userId,
            createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
            driveFolderId: { not: null },
          },
          orderBy: { createdAt: "desc" },
        });
        if (!created) await new Promise((r) => setTimeout(r, 1000));
      }
      if (!created?.driveFolderId) return fail("The case wasn't created, so the scan wasn't uploaded. Fix the form and try again.");
      folderId = await caseUploadFolder(created.driveFolderId, "SCANS");
    } else {
      const c = await prisma.case.findUnique({ where: { id: String(body?.caseId ?? "") }, include: VISIBILITY_INCLUDE });
      if (!c || !canViewCase(access, c)) return fail("Case not found.", 404);
      if (!c.driveFolderId) return fail("This case has no Drive folder to upload into.");
      let subfolder: CaseSubfolder | undefined;
      if (purpose === "design") subfolder = designSubfolder(c);
      else if (purpose === "tryInScans") subfolder = "TRYIN_SCANS";
      else if (purpose === "ibar") subfolder = "IBAR";
      else if (purpose === "matching") subfolder = "MATCHING_DATA";
      else if (purpose === "work") subfolder = uploadSubfolder(c.status, access.role.name);
      else if (purpose === "upload") {
        const chosen = body?.subfolder || undefined;
        if (chosen !== undefined && !isCaseSubfolder(chosen)) return fail("Pick a folder to upload into.");
        subfolder = chosen;
      }
      folderId = await caseUploadFolder(c.driveFolderId, subfolder);
    }

    const origin = request.headers.get("origin") || new URL(process.env.APP_URL || request.url).origin;
    const uploadUrl = await createDirectUpload({
      folderId,
      name,
      mimeType: String(body?.type || "application/octet-stream"),
      size,
      origin,
    });
    return NextResponse.json({ uploadUrl });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not start the upload.", 500);
  }
}
