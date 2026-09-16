import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getGoogleAuthUrl } from "@/lib/googleDrive";

export async function GET() {
  await requireRole("LAB_LEADER");
  return NextResponse.redirect(getGoogleAuthUrl());
}
