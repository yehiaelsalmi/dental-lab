import { writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { VISIBILITY_INCLUDE, can, canViewCase, getAccess } from "@/lib/access";
import { MAX_MEDIA_BYTES, ensureMediaDir, mediaPath, mediaType, removeMediaFile } from "@/lib/media";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Adds one photo or voice note to a case (multipart: "file", optional
// "durationSec" for voice notes). Saved on the server, not in Drive.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccess();
  if (!access) return fail("Please sign in again.", 401);
  if (!can(access, "case.media")) return fail("You're not allowed to add photos or voice notes.", 403);

  const { id: caseId } = await params;
  const c = await prisma.case.findUnique({ where: { id: caseId }, include: VISIBILITY_INCLUDE });
  if (!c || !canViewCase(access, c)) return fail("Case not found.", 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("No file was sent.");
  if (file.size > MAX_MEDIA_BYTES) return fail("That file is too big (30 MB at most).");
  const type = mediaType(file.type);
  if (!type) return fail("Only photos and voice recordings can be added here.");

  const duration = Number(form?.get("durationSec"));
  const media = await prisma.caseMedia.create({
    data: {
      caseId,
      kind: type.kind,
      ext: type.ext,
      mimeType: type.mimeType,
      size: file.size,
      durationSec: type.kind === "VOICE" && Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
      createdById: access.userId,
    },
  });
  try {
    await ensureMediaDir();
    await writeFile(mediaPath(media.id, media.ext), Buffer.from(await file.arrayBuffer()));
  } catch {
    await prisma.caseMedia.delete({ where: { id: media.id } }).catch(() => {});
    await removeMediaFile(media.id, media.ext).catch(() => {});
    return fail("Couldn't save the file on the server. Try again.", 500);
  }
  revalidatePath(`/cases/${caseId}`);
  return NextResponse.json({ id: media.id });
}
