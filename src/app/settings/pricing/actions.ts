"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "That name is already used.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

const materialSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  pricePerUnit: z.coerce.number().nonnegative(),
  ceramistFeePerUnit: z.coerce.number().nonnegative(),
  designerFeePerUnit: z.coerce.number().nonnegative(),
  ibarFeePerUnit: z.coerce.number().nonnegative().optional(),
  extraFee: z.coerce.number().nonnegative().optional(),
  deduction: z.coerce.number().nonnegative().optional(),
  millingCostPerUnit: z.coerce.number().nonnegative().optional(),
  photogrammetryCostPerUnit: z.coerce.number().nonnegative().optional(),
});

function parseMaterial(formData: FormData) {
  return materialSchema.safeParse({
    name: formData.get("name"),
    pricePerUnit: formData.get("pricePerUnit"),
    ceramistFeePerUnit: formData.get("ceramistFeePerUnit"),
    designerFeePerUnit: formData.get("designerFeePerUnit"),
    ibarFeePerUnit: emptyToUndefined(formData.get("ibarFeePerUnit")),
    extraFee: emptyToUndefined(formData.get("extraFee")),
    deduction: emptyToUndefined(formData.get("deduction")),
    millingCostPerUnit: emptyToUndefined(formData.get("millingCostPerUnit")),
    photogrammetryCostPerUnit: emptyToUndefined(formData.get("photogrammetryCostPerUnit")),
  });
}

export async function createMaterial(formData: FormData) {
  await requirePermission("page.pricing");

  const parsed = parseMaterial(formData);
  if (!parsed.success) {
    redirect(`/settings/pricing?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await prisma.material.create({ data: parsed.data });
  } catch (error) {
    redirect(`/settings/pricing?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/settings/pricing");
}

export async function updateMaterial(formData: FormData) {
  await requirePermission("page.pricing");
  const id = formData.get("id") as string;
  const back = `/settings/pricing/materials/${id}`;

  const parsed = parseMaterial(formData);
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    // Optional rates left blank are cleared, not kept.
    await prisma.material.update({
      where: { id },
      data: {
        ...parsed.data,
        ibarFeePerUnit: parsed.data.ibarFeePerUnit ?? null,
        extraFee: parsed.data.extraFee ?? null,
        deduction: parsed.data.deduction ?? null,
        millingCostPerUnit: parsed.data.millingCostPerUnit ?? null,
        photogrammetryCostPerUnit: parsed.data.photogrammetryCostPerUnit ?? null,
      },
    });
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/settings/pricing");
  redirect("/settings/pricing");
}

export async function deleteMaterial(formData: FormData) {
  await requirePermission("page.pricing");
  const id = formData.get("id") as string;

  const used = await prisma.case.count({ where: { materialId: id } });
  if (used > 0) {
    redirect(
      `/settings/pricing/materials/${id}?error=${encodeURIComponent(
        `This material is used by ${used} case${used === 1 ? "" : "s"}, so it can't be deleted.`
      )}`
    );
  }

  await prisma.material.delete({ where: { id } });
  revalidatePath("/settings/pricing");
  redirect("/settings/pricing");
}

const metalSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  cost: z.coerce.number().nonnegative(),
});

function parseMetal(formData: FormData) {
  return metalSchema.safeParse({ name: formData.get("name"), cost: formData.get("cost") });
}

export async function createMetalType(formData: FormData) {
  await requirePermission("page.pricing");

  const parsed = parseMetal(formData);
  if (!parsed.success) {
    redirect(`/settings/pricing?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await prisma.metalType.create({ data: parsed.data });
  } catch (error) {
    redirect(`/settings/pricing?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/settings/pricing");
}

export async function updateMetalType(formData: FormData) {
  await requirePermission("page.pricing");
  const id = formData.get("id") as string;
  const back = `/settings/pricing/metals/${id}`;

  const parsed = parseMetal(formData);
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await prisma.metalType.update({ where: { id }, data: parsed.data });
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/settings/pricing");
  redirect("/settings/pricing");
}

export async function deleteMetalType(formData: FormData) {
  await requirePermission("page.pricing");
  const id = formData.get("id") as string;

  const used = await prisma.case.count({ where: { metalTypeId: id } });
  if (used > 0) {
    redirect(
      `/settings/pricing/metals/${id}?error=${encodeURIComponent(
        `This metal type is used by ${used} case${used === 1 ? "" : "s"}, so it can't be deleted.`
      )}`
    );
  }

  await prisma.metalType.delete({ where: { id } });
  revalidatePath("/settings/pricing");
  redirect("/settings/pricing");
}
