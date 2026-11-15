import { prisma } from "@/lib/prisma";
import { setSetting } from "@/lib/settings";

// Notifications by WhatsApp, through Meta's WhatsApp Business Cloud API.
// Business-started messages must use a template approved by Meta, so every
// notification is sent with one template (see WHATSAPP_TEMPLATE_TEXT) whose
// three parameters are the person's name, the message and the case link.

export const WHATSAPP_KEYS = {
  phoneNumberId: "whatsapp.phoneNumberId",
  token: "whatsapp.token",
  template: "whatsapp.template",
  language: "whatsapp.language",
} as const;

export const DEFAULT_TEMPLATE = "case_update";
export const DEFAULT_LANGUAGE = "en";

// What to submit to Meta as the template body (category: Utility).
export const WHATSAPP_TEMPLATE_TEXT =
  "Hello {{1}}, there is an update in the lab system: {{2}}. Open the case: {{3}}";

export type WhatsAppSettings = {
  phoneNumberId: string;
  token: string;
  template: string;
  language: string;
  configured: boolean;
};

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.values(WHATSAPP_KEYS) } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() ?? "";
  const phoneNumberId = get(WHATSAPP_KEYS.phoneNumberId);
  const token = get(WHATSAPP_KEYS.token);
  return {
    phoneNumberId,
    token,
    template: get(WHATSAPP_KEYS.template) || DEFAULT_TEMPLATE,
    language: get(WHATSAPP_KEYS.language) || DEFAULT_LANGUAGE,
    configured: !!phoneNumberId && !!token,
  };
}

export async function saveWhatsAppSettings(input: Partial<Omit<WhatsAppSettings, "configured">>) {
  for (const [field, key] of Object.entries(WHATSAPP_KEYS) as [keyof typeof WHATSAPP_KEYS, string][]) {
    const value = input[field];
    if (value !== undefined) await setSetting(key, value.trim());
  }
}

// "01012345678" / "+20 101 234 5678" -> "201012345678" (Egypt by default).
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) return `2${digits}`;
  return digits.length >= 10 ? digits : null;
}

// Template parameters can't contain new lines, tabs or long runs of spaces.
function clean(text: string) {
  return text.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 900);
}

// Sends one notification; returns an error message, or null if Meta accepted it.
export async function sendWhatsApp(
  settings: WhatsAppSettings,
  to: string,
  params: { name: string; message: string; link: string }
): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${settings.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: settings.template,
          language: { code: settings.language },
          components: [
            {
              type: "body",
              parameters: [params.name, params.message, params.link].map((t) => ({ type: "text", text: clean(t) || "-" })),
            },
          ],
        },
      }),
    });
    if (res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return body?.error?.message ?? `WhatsApp answered ${res.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : "Could not reach WhatsApp.";
  }
}

// Sends to everyone with a WhatsApp number, in the background (errors are
// logged, never shown to the person who triggered the notification).
export function sendWhatsAppMany(
  settings: WhatsAppSettings,
  recipients: { name: string; phone: string | null }[],
  message: string,
  link: string
) {
  void (async () => {
    for (const r of recipients) {
      const to = toWhatsAppNumber(r.phone);
      if (!to) continue;
      const error = await sendWhatsApp(settings, to, { name: r.name, message, link });
      if (error) console.error(`[whatsapp] to ${to}: ${error}`);
    }
  })();
}
