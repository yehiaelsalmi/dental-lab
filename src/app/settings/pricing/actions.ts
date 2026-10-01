"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

const materialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pricePerUnit: z.coerce.number().nonnegative(),
  ceramistFeePerUnit: z.coerce.number().nonnegative(),
  designerFeePerUnit: z.coerce.number().nonnegative(),
  ibarFeePerUnit: z.coerce.number().nonnegative().optional(),
  extraFee: z.coerce.number().nonnegative().optional(),
  deduction: z.coerce.number().nonnegative().optional(),
});

export async function createMaterial(formData: FormData) {
  await requireRole("LAB_LEADER");

  const parsed = materialSchema.safeParse({
    name: formData.get("name"),
    pricePerUnit: formData.get("pricePerUnit"),
    ceramistFeePerUnit: formData.get("ceramistFeePerUnit"),
    designerFeePerUnit: formData.get("designerFeePerUnit"),
    ibarFeePerUnit: emptyToUndefined(formData.get("ibarFeePerUnit")),
    extraFee: emptyToUndefined(formData.get("extraFee")),
    deduction: emptyToUndefined(formData.get("deduction")),
  });

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

const metalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cost: z.coerce.number().nonnegative(),
});

export async function createMetalType(formData: FormData) {
  await requireRole("LAB_LEADER");

  const parsed = metalSchema.safeParse({
    name: formData.get("name"),
    cost: formData.get("cost"),
  });

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
