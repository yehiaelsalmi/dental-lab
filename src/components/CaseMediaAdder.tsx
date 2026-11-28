"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileAudio, ImagePlus, Loader2 } from "lucide-react";

// Uploads photos and voice note files to a case. Photos are shrunk in the
// browser first (big phone photos upload slowly). Both go to the system's own
// server, not to Drive.

const MAX_SIDE = 2000;

// Voice note files whose type the browser doesn't report (e.g. WhatsApp .opus).
const AUDIO_BY_EXT: Record<string, string> = {
  opus: "audio/ogg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  webm: "audio/webm",
};

function ext(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // a format the browser can't draw (e.g. HEIC on a PC): send as is
  }
}

// Length of an audio file in seconds, if the browser can read it.
function audioSeconds(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    audio.src = url;
  });
}

function send(caseId: string, blob: Blob, name: string, extra: Record<string, string>, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const data = new FormData();
    data.append("file", blob, name);
    for (const [k, v] of Object.entries(extra)) data.append(k, v);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/cases/${caseId}/media`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "Upload failed. Try again.";
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("No connection. Check the internet and try again."));
    xhr.send(data);
  });
}

export function CaseMediaAdder({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null, kind: "photo" | "voice") {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setError(null);
    try {
      for (const [i, file] of list.entries()) {
        const what = kind === "photo" ? "photo" : "voice note";
        const label = list.length > 1 ? `Uploading ${what} ${i + 1} of ${list.length}` : `Uploading ${what}`;
        setBusy(`${label}…`);
        let blob: Blob = file;
        let name = file.name;
        const extra: Record<string, string> = {};
        if (kind === "photo") {
          blob = await shrinkPhoto(file);
          if (blob !== file) name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        } else {
          const type = file.type || AUDIO_BY_EXT[ext(file.name)];
          if (!type?.startsWith("audio/")) throw new Error(`"${file.name}" isn't a voice note (audio) file.`);
          if (type !== file.type) blob = new Blob([file], { type });
          const secs = await audioSeconds(blob);
          if (secs) extra.durationSec = String(Math.round(secs));
        }
        await send(caseId, blob, name, extra, (p) => setBusy(`${label}… ${Math.round(p * 100)}%`));
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (photoInput.current) photoInput.current.value = "";
      if (audioInput.current) audioInput.current.value = "";
    }
  }

  const button =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={!!busy} onClick={() => photoInput.current?.click()}>
          <ImagePlus size={15} className="text-brand" />
          Upload photos
        </button>
        <button type="button" className={button} disabled={!!busy} onClick={() => audioInput.current?.click()}>
          <FileAudio size={15} className="text-rose-600" />
          Upload voice note
        </button>
        <input ref={photoInput} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files, "photo")} />
        <input
          ref={audioInput}
          type="file"
          accept="audio/*,.opus,.ogg,.m4a,.mp3,.aac,.wav"
          multiple
          className="sr-only"
          onChange={(e) => upload(e.target.files, "voice")}
        />
      </div>
      {busy && (
        <p className="flex items-center gap-2 text-sm text-brand">
          <Loader2 size={14} className="animate-spin" />
          {busy}
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
