"use client";

import { useRef, useState } from "react";
import { CheckCircle2, UploadCloud, WifiOff } from "lucide-react";

const CHUNK = 8 * 1024 * 1024; // 8 MB pieces (Google needs multiples of 256 KB)

type Phase = "idle" | "uploading" | "waiting" | "done" | "error";

function mb(bytes: number) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

// Sends one piece; resolves with the HTTP status, the Range Google has, and
// the body. Reports upload progress within the piece.
function sendPiece(url: string, file: File, start: number, onProgress: (sent: number) => void) {
  const end = Math.min(start + CHUNK, file.size);
  return new Promise<{ status: number; range: string | null; body: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);
    xhr.upload.onprogress = (e) => onProgress(start + e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader("Range"), body: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    xhr.timeout = 120_000;
    xhr.send(file.slice(start, end));
  });
}

// Asks Google how much of the file it already has (after a dropped connection).
function askStatus(url: string, size: number) {
  return new Promise<{ status: number; range: string | null; body: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", `bytes */${size}`);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader("Range"), body: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.send();
  });
}

const nextOffset = (range: string | null) => (range ? Number(range.split("-")[1]) + 1 : 0);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DirectUploadDemo() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sent, setSent] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [drops, setDrops] = useState(0);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const started = useRef(0);

  async function start() {
    if (!file) return;
    setPhase("uploading");
    setSent(0);
    setDrops(0);
    setMessage("");
    setLink("");
    started.current = Date.now();

    const res = await fetch("/api/drive-upload/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !data.uploadUrl) {
      setPhase("error");
      setMessage(data.error ?? "Could not start the upload.");
      return;
    }
    const url: string = data.uploadUrl;

    let offset = 0;
    const progress = (bytes: number) => {
      setSent(bytes);
      const secs = (Date.now() - started.current) / 1000;
      if (secs > 0.5) setSpeed(bytes / secs);
    };

    for (;;) {
      try {
        const r = await sendPiece(url, file, offset, progress);
        if (r.status === 200 || r.status === 201) {
          setSent(file.size);
          setLink(JSON.parse(r.body).webViewLink ?? "");
          setPhase("done");
          return;
        }
        if (r.status === 308) {
          offset = nextOffset(r.range);
          setSent(offset);
          continue;
        }
        throw new Error(r.status >= 500 ? "network" : `Google answered ${r.status}`);
      } catch (error) {
        if ((error as Error).message !== "network") {
          setPhase("error");
          setMessage((error as Error).message);
          return;
        }
        // Connection dropped: wait for the internet, then ask Google where it stopped.
        setDrops((d) => d + 1);
        setPhase("waiting");
        for (;;) {
          while (!navigator.onLine) await wait(1000);
          await wait(2000);
          try {
            const s = await askStatus(url, file.size);
            if (s.status === 200 || s.status === 201) {
              setSent(file.size);
              setLink(JSON.parse(s.body).webViewLink ?? "");
              setPhase("done");
              return;
            }
            offset = nextOffset(s.range);
            setSent(offset);
            break;
          } catch {
            // still offline; keep waiting
          }
        }
        setPhase("uploading");
      }
    }
  }

  const pct = file && file.size ? Math.floor((sent / file.size) * 100) : 0;
  const remaining = speed > 0 && file ? (file.size - sent) / speed : NaN;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 text-center hover:border-brand/40 hover:bg-brand-soft/40">
        <UploadCloud className="text-slate-400" size={22} />
        <span className="text-sm font-medium text-slate-700">
          {file ? `${file.name} (${mb(file.size)})` : "Click to choose a file (try a big one)"}
        </span>
        <input
          type="file"
          className="hidden"
          disabled={phase === "uploading" || phase === "waiting"}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPhase("idle");
            setSent(0);
          }}
        />
      </label>

      <button
        type="button"
        onClick={start}
        disabled={!file || phase === "uploading" || phase === "waiting"}
        className="self-start rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover disabled:opacity-50"
      >
        Start fast upload
      </button>

      {phase !== "idle" && file && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="mb-2 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${phase === "waiting" ? "bg-amber-500" : phase === "error" ? "bg-rose-500" : "bg-brand"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-slate-700">
            <strong>{pct}%</strong>
            <span>
              {mb(sent)} of {mb(file.size)}
            </span>
            {phase === "uploading" && speed > 0 && (
              <span className="text-slate-500">
                · {mb(speed)}/s · about {duration(remaining)} left
              </span>
            )}
          </p>
          {phase === "waiting" && (
            <p className="mt-1 flex items-center gap-1.5 text-amber-700">
              <WifiOff size={14} /> Connection lost. It will continue from {pct}% as soon as the internet is back.
            </p>
          )}
          {drops > 0 && phase !== "waiting" && (
            <p className="mt-1 text-xs text-slate-500">
              Recovered from {drops} dropped connection{drops === 1 ? "" : "s"} without starting over.
            </p>
          )}
          {phase === "done" && (
            <p className="mt-1 flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 size={14} /> Uploaded in {duration((Date.now() - started.current) / 1000)}.
              {link && (
                <a href={link} target="_blank" rel="noreferrer" className="font-medium underline">
                  Open in Drive
                </a>
              )}
            </p>
          )}
          {phase === "error" && <p className="mt-1 text-rose-700">{message}</p>}
        </div>
      )}
    </div>
  );
}
