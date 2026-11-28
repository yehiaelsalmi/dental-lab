import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { VISIBILITY_INCLUDE, canViewCase, getAccess } from "@/lib/access";
import { mediaPath } from "@/lib/media";

// Serves a case photo or voice note to people who can see the case. Supports
// byte ranges, which phones (Safari especially) need to play audio.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccess();
  if (!access) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const media = await prisma.caseMedia.findUnique({ where: { id }, include: { case: { include: VISIBILITY_INCLUDE } } });
  if (!media || !canViewCase(access, media.case)) return new Response("Not found", { status: 404 });

  const file = mediaPath(media.id, media.ext);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response("That file is missing on the server.", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": media.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=604800, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${media.kind === "PHOTO" ? "photo" : "voice-note"}-${media.id}.${media.ext}"`,
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}
