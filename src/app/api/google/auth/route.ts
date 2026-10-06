import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/access";
import { getGoogleAuthUrl } from "@/lib/googleDrive";

export async function GET() {
  await requirePermission("page.drive");
  return NextResponse.redirect(getGoogleAuthUrl());
}
