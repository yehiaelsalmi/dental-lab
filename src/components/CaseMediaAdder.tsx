"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Mic, Send, Square, Trash2 } from "lucide-react";

// Adds photos and voice notes to a case. Photos are shrunk in the browser
// first (big phone photos upload slowly); voice notes are recorded right here.
// Both go to the system's own server, not to Drive.

const MAX_SIDE = 2000;
const MAX_RECORD_SECONDS = 10 * 60;

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

function pickRecorderType(): string {
  for (const t of ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function clock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CaseMediaAdder({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // Let go of the microphone and the preview if the page is left mid-way.
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  async function addPhotos(files: FileList | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (list.length === 0) return;
    setError(null);
    try {
      for (const [i, file] of list.entries()) {
        const label = list.length > 1 ? `Sending photo ${i + 1} of ${list.length}` : "Sending photo";
        setBusy(`${label}…`);
        const blob = await shrinkPhoto(file);
        const name = blob === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
        await send(caseId, blob, name, {}, (p) => setBusy(`${label}… ${Math.round(p * 100)}%`));
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (photoInput.current) photoInput.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    }
  }

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record voice notes.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Allow the microphone for this site to record a voice note.");
      return;
    }
    const type = pickRecorderType();
    const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 48000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      const blob = new Blob(chunks, { type: (rec.mimeType || type || "audio/webm").split(";")[0] });
      const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      setRecording(false);
      if (blob.size > 0) setTake({ blob, url: URL.createObjectURL(blob), seconds: secs });
    };
    recorder.current = rec;
    started.current = Date.now();
    setSeconds(0);
    rec.start(1000);
    setRecording(true);
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= MAX_RECORD_SECONDS && rec.state === "recording") rec.stop();
    }, 500);
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function discard() {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
  }

  async function sendVoice() {
    if (!take) return;
    setError(null);
    const ext = take.blob.type.includes("mp4") ? "m4a" : take.blob.type.includes("ogg") ? "ogg" : "webm";
    try {
      setBusy("Sending voice note…");
      await send(caseId, take.blob, `voice-note.${ext}`, { durationSec: String(take.seconds) }, (p) =>
        setBusy(`Sending voice note… ${Math.round(p * 100)}%`)
      );
      discard();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const button =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* On phones this opens the camera; on a PC it picks a file. */}
        <button type="button" className={button} disabled={!!busy || recording} onClick={() => cameraInput.current?.click()}>
          <Camera size={15} className="text-brand" />
          Take photo
        </button>
        <button type="button" className={button} disabled={!!busy || recording} onClick={() => photoInput.current?.click()}>
          <ImagePlus size={15} className="text-brand" />
          Add photos
        </button>
        {!recording && !take && (
          <button type="button" className={button} disabled={!!busy} onClick={startRecording}>
            <Mic size={15} className="text-rose-600" />
            Record voice note
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Recording {clock(seconds)}
            <Square size={13} className="fill-white" />
            Stop
          </button>
        )}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
        <input ref={photoInput} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
      </div>

      {take && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <audio src={take.url} controls className="h-9 min-w-0 flex-1" />
          <button
            type="button"
            onClick={sendVoice}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            <Send size={14} />
            Send
          </button>
          <button type="button" onClick={discard} disabled={!!busy} className="p-2 text-slate-400 hover:text-rose-600" aria-label="Discard recording">
            <Trash2 size={15} />
          </button>
        </div>
      )}

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
