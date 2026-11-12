import { NextResponse } from "next/server";
import { can, getAccess } from "@/lib/access";
import { createDirectUpload, getTestUploadFolder } from "@/lib/googleDrive";

// Demo of uploading straight from the browser to Drive (Drive Settings):
// returns a one-time upload link into the "test uploads" folder.
export async function POST(request: Request) {
  const access = await getAccess();
  if (!access || !can(access, "page.drive")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim().slice(0, 200);
  const size = Number(body?.size);
  if (!name || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Pick a file first." }, { status: 400 });
  }
  const origin = request.headers.get("origin") || new URL(process.env.APP_URL || request.url).origin;
  try {
    const uploadUrl = await createDirectUpload({
      folderId: await getTestUploadFolder(),
      name,
      mimeType: String(body?.type || "application/octet-stream"),
      size,
      origin,
    });
    return NextResponse.json({ uploadUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the upload." }, { status: 500 });
  }
}
