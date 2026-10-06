"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { caseUnits } from "@/lib/reporting";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "An invoice for this doctor and month already exists. Delete it first to regenerate.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

const generateSchema = z.object({
  doctorId: z.string().min(1, "Select a doctor"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
});

export async function generateInvoice(formData: FormData) {
  const session = await requirePermission("page.invoices");

  const parsed = generateSchema.safeParse({
    doctorId: formData.get("doctorId"),
    month: formData.get("month"),
  });

  if (!parsed.success) {
    redirect(`/invoices?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const { doctorId, month } = parsed.data;
  const [year, monthNum] = month.split("-").map(Number);
  const periodStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const periodEnd = new Date(Date.UTC(year, monthNum, 1));

  try {
    const cases = await prisma.case.findMany({
      where: {
        doctorId,
        entryDate: { gte: periodStart, lt: periodEnd },
        totalPrice: { not: null },
      },
      orderBy: { entryDate: "asc" },
    });

    if (cases.length === 0) {
      throw new Error("No priced cases for that doctor in that month.");
    }

    const totalAmount = cases.reduce((sum, c) => sum + (c.totalPrice ?? 0), 0);

    await prisma.invoice.create({
      data: {
        doctorId,
        periodStart,
        periodEnd,
        totalAmount,
        generatedById: session.userId,
        lines: {
          create: cases.map((c) => ({
            patientName: c.patientName,
            units: caseUnits(c),
            amount: c.totalPrice ?? 0,
            caseId: c.id,
          })),
        },
      },
    });
  } catch (error) {
    redirect(`/invoices?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/invoices");
}

export async function deleteInvoice(formData: FormData) {
  await requirePermission("page.invoices");

  const invoiceId = formData.get("invoiceId") as string;
  await prisma.invoice.delete({ where: { id: invoiceId } });

  revalidatePath("/invoices");
}
