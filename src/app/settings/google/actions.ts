"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/access";
import { regenerateSyncSecret } from "@/lib/driveSync";
import { ensureRootFolder } from "@/lib/googleDrive";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function createRootFolderAction() {
  await requirePermission("page.drive");

  try {
    await ensureRootFolder();
  } catch (error) {
    redirect(`/settings/google?error=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect("/settings/google?saved=1");
}

// A new secret: the old script stops working until the new one is pasted.
export async function regenerateSyncSecretAction() {
  await requirePermission("page.drive");
  await regenerateSyncSecret();
  redirect("/settings/google?secret=1");
}
