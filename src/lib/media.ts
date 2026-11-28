import path from "node:path";
import { mkdir, rm } from "node:fs/promises";

// Photos and voice notes live on the server's disk (not in Drive), under
// MEDIA_DIR (in production a folder outside the app, so deploys never touch
// it), named <media id>.<ext>.
export function mediaDir(): string {
  return process.env.MEDIA_DIR || path.join(process.cwd(), "media-files");
}

export function mediaPath(id: string, ext: string): string {
  return path.join(mediaDir(), `${id}.${ext}`);
}

export async function ensureMediaDir(): Promise<void> {
  await mkdir(mediaDir(), { recursive: true });
}

export async function removeMediaFile(id: string, ext: string): Promise<void> {
  await rm(mediaPath(id, ext), { force: true });
}

// What may be uploaded, and the extension it's saved with.
const TYPES: Record<string, { kind: "PHOTO" | "VOICE"; ext: string }> = {
  "image/jpeg": { kind: "PHOTO", ext: "jpg" },
  "image/png": { kind: "PHOTO", ext: "png" },
  "image/webp": { kind: "PHOTO", ext: "webp" },
  "image/heic": { kind: "PHOTO", ext: "heic" },
  "image/heif": { kind: "PHOTO", ext: "heif" },
  "audio/webm": { kind: "VOICE", ext: "webm" },
  "audio/ogg": { kind: "VOICE", ext: "ogg" },
  "audio/mp4": { kind: "VOICE", ext: "m4a" },
  "audio/x-m4a": { kind: "VOICE", ext: "m4a" },
  "audio/aac": { kind: "VOICE", ext: "aac" },
  "audio/mpeg": { kind: "VOICE", ext: "mp3" },
  "audio/mp3": { kind: "VOICE", ext: "mp3" },
  "audio/opus": { kind: "VOICE", ext: "ogg" },
  "audio/x-aac": { kind: "VOICE", ext: "aac" },
  "audio/wav": { kind: "VOICE", ext: "wav" },
  "audio/x-wav": { kind: "VOICE", ext: "wav" },
};

// "audio/webm;codecs=opus" -> the entry for "audio/webm".
export function mediaType(mime: string) {
  const base = mime.split(";")[0].trim().toLowerCase();
  const t = TYPES[base];
  return t ? { ...t, mimeType: base } : null;
}

export const MAX_MEDIA_BYTES = 30 * 1024 * 1024;

export function durationText(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
