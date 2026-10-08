import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { LAB_INITIALS, LAB_NAME } from "@/lib/constants";

// Settings the Lab Leader edits on the Lab Settings page, stored in AppSetting.
export const LAB_SETTING_KEYS = {
  name: "lab.name",
  logo: "lab.logo", // data URL (PNG or JPEG)
  invoiceAddress: "invoice.address",
  invoicePhone: "invoice.phone",
  invoicePayment: "invoice.payment",
  invoiceFooter: "invoice.footer",
  staleDays: "alerts.staleDays",
  dueSoonDays: "alerts.dueSoonDays",
} as const;

export type LabSettings = {
  name: string;
  initials: string;
  logoDataUrl: string | null;
  invoiceAddress: string;
  invoicePhone: string;
  invoicePayment: string;
  invoiceFooter: string;
  // A case with a designer and no progress for this many days is "forgotten".
  staleDays: number;
  // Cases due within this many days (1 = tomorrow) are flagged.
  dueSoonDays: number;
};

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [name.trim().slice(0, 2)];
  return letters.join("").toUpperCase() || "LAB";
}

function wholeNumber(value: string | undefined, fallback: number, min: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

export const getLabSettings = cache(async (): Promise<LabSettings> => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(LAB_SETTING_KEYS) } },
  });
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const name = get(LAB_SETTING_KEYS.name)?.trim() || LAB_NAME;
  return {
    name,
    // Keep the lab's own "A4" mark until the name is changed.
    initials: name === LAB_NAME ? LAB_INITIALS : initialsOf(name),
    logoDataUrl: get(LAB_SETTING_KEYS.logo) || null,
    invoiceAddress: get(LAB_SETTING_KEYS.invoiceAddress) ?? "",
    invoicePhone: get(LAB_SETTING_KEYS.invoicePhone) ?? "",
    invoicePayment: get(LAB_SETTING_KEYS.invoicePayment) ?? "",
    invoiceFooter: get(LAB_SETTING_KEYS.invoiceFooter) ?? "",
    staleDays: wholeNumber(get(LAB_SETTING_KEYS.staleDays), 2, 1),
    dueSoonDays: wholeNumber(get(LAB_SETTING_KEYS.dueSoonDays), 1, 0),
  };
});

// The logo as raw bytes, for PDFs.
export function logoBuffer(settings: LabSettings): Buffer | null {
  const match = settings.logoDataUrl?.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  return match ? Buffer.from(match[2], "base64") : null;
}

// What PDFs need to draw the lab header.
export type PdfLab = { name: string; initials: string; logo: Buffer | null };

export function pdfLab(settings: LabSettings): PdfLab {
  return { name: settings.name, initials: settings.initials, logo: logoBuffer(settings) };
}
