import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { exchangeCodeForRefreshToken } from "@/lib/googleDrive";

export async function GET(request: NextRequest) {
  await requireRole("LAB_LEADER");

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/settings/google?error=missing_code", request.url));
  }

  try {
    await exchangeCodeForRefreshToken(code);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/settings/google?error=${encodeURIComponent(message)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL("/settings/google?connected=1", request.url));
}
