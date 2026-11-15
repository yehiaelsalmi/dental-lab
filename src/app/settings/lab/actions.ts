"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { setSetting } from "@/lib/settings";
import { LAB_SETTING_KEYS, parsePaymentMethods } from "@/lib/labSettings";
import { getWhatsAppSettings, saveWhatsAppSettings, sendWhatsApp, toWhatsAppNumber } from "@/lib/whatsapp";
import { caseUrl } from "@/lib/email";

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

  const paymentMethods = parsePaymentMethods(String(formData.get("paymentMethods") ?? ""));
  if (paymentMethods.length === 0) fail("Add at least one payment method.");

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
    setSetting(LAB_SETTING_KEYS.paymentMethods, paymentMethods.join("\n")),
  ]);
  if (logoDataUrl) await setSetting(LAB_SETTING_KEYS.logo, logoDataUrl);
  else if (formData.get("removeLogo") === "on") {
    await prisma.appSetting.deleteMany({ where: { key: LAB_SETTING_KEYS.logo } });
  }

  revalidatePath("/", "layout");
  redirect("/settings/lab?saved=1");
}

// WhatsApp connection details from Meta. A blank token keeps the saved one.
export async function saveWhatsAppAction(formData: FormData) {
  await requirePermission("page.settings");
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const phoneNumberId = text("phoneNumberId");
  if (phoneNumberId && !/^\d{6,30}$/.test(phoneNumberId)) {
    redirect(`/settings/lab?waError=${encodeURIComponent("The Phone number ID is a long number from Meta's WhatsApp page.")}`);
  }
  await saveWhatsAppSettings({
    phoneNumberId,
    ...(text("token") ? { token: text("token") } : {}),
    template: text("template") || "case_update",
    language: text("language") || "en",
  });
  if (formData.get("disconnect") === "1") await saveWhatsAppSettings({ token: "" });
  revalidatePath("/settings/lab");
  redirect("/settings/lab?waSaved=1");
}

// Sends the notification template to the signed-in person's own number.
export async function testWhatsAppAction() {
  const session = await requirePermission("page.settings");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, phone: true } });
  const to = toWhatsAppNumber(me?.phone);
  const fail = (m: string): never => redirect(`/settings/lab?waError=${encodeURIComponent(m)}`);
  if (!to) fail("Add your WhatsApp number on My Account first.");
  const settings = await getWhatsAppSettings();
  if (!settings.configured) fail("Save the Phone number ID and access token first.");
  const error = await sendWhatsApp(settings, to as string, {
    name: me!.name,
    message: "this is a test notification",
    link: caseUrl("test").replace(/\/cases\/test$/, "/cases"),
  });
  if (error) fail(`WhatsApp refused the test: ${error}`);
  redirect(`/settings/lab?waTest=${encodeURIComponent(to as string)}`);
}
