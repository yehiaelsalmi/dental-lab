import nodemailer from "nodemailer";
import { getLabSettings } from "@/lib/labSettings";

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function caseUrl(caseId: string) {
  // `||` rather than `??`: an empty APP_URL="" in .env must fall through too.
  const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/cases/${caseId}`;
}

// Fire-and-forget: a mail problem must never break the action that triggered it.
export function sendEmail(to: string | string[], subject: string, message: string, link?: string) {
  if (!isConfigured()) return;
  void deliver(to, subject, message, link);
}

async function deliver(to: string | string[], subject: string, message: string, link?: string) {
  const labName = (await getLabSettings().catch(() => null))?.name ?? "Dental lab";

  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });

  const safeMessage = escapeHtml(message);
  const html = `<p>${safeMessage}</p>${
    link ? `<p><a href="${escapeHtml(link)}">Open the case</a></p>` : ""
  }<p style="color:#64748b">${escapeHtml(labName)}</p>`;

  transporter
    .sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: recipients,
      subject,
      text: `${message}${link ? `\n\n${link}` : ""}\n\n${labName}`,
      html,
    })
    .catch((error) => {
      console.error("Failed to send notification email:", error instanceof Error ? error.message : error);
    });
}
