import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VISIBILITY_INCLUDE, can, canViewCase, getAccess } from "@/lib/access";
import type { Permission } from "@/lib/permissions";
import { caseUploadFolder, createCaseFolder, createDirectUpload } from "@/lib/googleDrive";
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
      const patientName = String(body?.patientName ?? "").trim();
      const doctorName =
        String(body?.newDoctorName ?? "").trim() ||
        (body?.doctorId ? (await prisma.doctor.findUnique({ where: { id: String(body.doctorId) } }))?.name : "") ||
        "";
      if (!patientName || !doctorName) return fail("Fill in the doctor and patient first.");
      const folder = await createCaseFolder(doctorName, patientName);
      folderId = await caseUploadFolder(folder.id, "SCANS");
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
