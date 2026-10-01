"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { listDoctorFolderNames, setRootFolder } from "@/lib/googleDrive";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function setRootFolderAction(formData: FormData) {
  await requireRole("LAB_LEADER");

  const link = String(formData.get("folderLink") ?? "");
  try {
    await setRootFolder(link);
  } catch (error) {
    redirect(`/settings/google?error=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect("/settings/google?saved=1");
}

export async function importDoctorsAction() {
  await requireRole("LAB_LEADER");

  let added = 0;
  try {
    const names = await listDoctorFolderNames();
    for (const name of names) {
      if (!name) continue;
      const existing = await prisma.doctor.findUnique({ where: { name } });
      if (existing) continue;
      await prisma.doctor.create({ data: { name } });
      added++;
    }
  } catch (error) {
    redirect(`/settings/google?error=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect(`/settings/google?imported=${added}`);
}
