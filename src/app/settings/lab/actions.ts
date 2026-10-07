"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { setSetting } from "@/lib/settings";
import { LAB_SETTING_KEYS } from "@/lib/labSettings";

const MAX_LOGO_BYTES = 1024 * 1024;

function fail(message: string): never {
  redirect(`/settings/lab?error=${encodeURIComponent(message)}`);
}

export async function saveLabSettings(formData: FormData) {
  await requirePermission("page.settings");
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const name = text("name");
  if (!name) fail("The lab name can't be empty.");
  if (name.length > 80) fail("Keep the lab name under 80 characters.");

  const staleDays = Number(text("staleDays"));
  const dueSoonDays = Number(text("dueSoonDays"));
  if (!Number.isInteger(staleDays) || staleDays < 1) fail("'Forgotten after' must be at least 1 day.");
  if (!Number.isInteger(dueSoonDays) || dueSoonDays < 0) fail("'Due soon' must be 0 days or more.");

  // PNG or JPEG only, so it can go into the PDFs too.
  const logo = formData.get("logo");
  let logoDataUrl: string | null = null;
  if (logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg"].includes(logo.type)) fail("The logo must be a PNG or JPG image.");
    if (logo.size > MAX_LOGO_BYTES) fail("The logo must be under 1 MB.");
    logoDataUrl = `data:${logo.type};base64,${Buffer.from(await logo.arrayBuffer()).toString("base64")}`;
  }

  await Promise.all([
    setSetting(LAB_SETTING_KEYS.name, name),
    setSetting(LAB_SETTING_KEYS.invoiceAddress, text("invoiceAddress")),
    setSetting(LAB_SETTING_KEYS.invoicePhone, text("invoicePhone")),
    setSetting(LAB_SETTING_KEYS.invoicePayment, text("invoicePayment")),
    setSetting(LAB_SETTING_KEYS.invoiceFooter, text("invoiceFooter")),
    setSetting(LAB_SETTING_KEYS.staleDays, String(staleDays)),
    setSetting(LAB_SETTING_KEYS.dueSoonDays, String(dueSoonDays)),
  ]);
  if (logoDataUrl) await setSetting(LAB_SETTING_KEYS.logo, logoDataUrl);
  else if (formData.get("removeLogo") === "on") {
    await prisma.appSetting.deleteMany({ where: { key: LAB_SETTING_KEYS.logo } });
  }

  revalidatePath("/", "layout");
  redirect("/settings/lab?saved=1");
}
