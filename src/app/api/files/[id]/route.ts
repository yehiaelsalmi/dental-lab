import { Readable } from "node:stream";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { downloadFileStream } from "@/lib/googleDrive";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const file = await prisma.caseFile.findUnique({
    where: { id },
    include: { case: { select: { assignedDesignerId: true } } },
  });
  if (!file) return new Response("Not found", { status: 404 });

  const { role, id: userId } = session.user;
  if (role === "DESIGNER" && file.case.assignedDesignerId !== userId) {
    return new Response("Forbidden", { status: 403 });
  }

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
