"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";

function back(params: string): never {
  redirect(`/doctors?${params}`);
}

export async function renameDoctor(formData: FormData) {
  await requirePermission("page.doctors");
  const id = formData.get("id") as string;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back(`error=${encodeURIComponent("The name can't be empty.")}`);

  const clash = await prisma.doctor.findUnique({ where: { name } });
  if (clash && clash.id !== id) back(`error=${encodeURIComponent(`There is already a doctor called ${name}.`)}`);

  await prisma.doctor.update({ where: { id }, data: { name } });
  revalidatePath("/doctors");
  back("saved=1");
}

// Only doctors with no cases or invoices can be deleted, so history is never lost.
export async function deleteDoctor(formData: FormData) {
  await requirePermission("page.doctors");
  const id = formData.get("id") as string;

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: { _count: { select: { cases: true, invoices: true } } },
  });
  if (!doctor) back("");
  if (doctor._count.cases + doctor._count.invoices > 0) {
    back(`error=${encodeURIComponent(`${doctor.name} has cases or invoices, so it can't be deleted.`)}`);
  }

  await prisma.doctor.delete({ where: { id } });
  revalidatePath("/doctors");
  back(`deleted=${encodeURIComponent(doctor.name)}`);
}
