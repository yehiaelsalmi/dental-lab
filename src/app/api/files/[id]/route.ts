import { Readable } from "node:stream";
import { canViewCase, getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { downloadFileStream } from "@/lib/googleDrive";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccess();
  if (!access) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const file = await prisma.caseFile.findUnique({
    where: { id },
    include: { case: true },
  });
  if (!file) return new Response("Not found", { status: 404 });

  if (!canViewCase(access, file.case)) return new Response("Forbidden", { status: 403 });

  let stream: Readable;
  try {
    stream = await downloadFileStream(file.driveFileId);
  } catch {
    return new Response("Couldn't fetch that file from Drive.", { status: 502 });
  }

  const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    },
  });
}
