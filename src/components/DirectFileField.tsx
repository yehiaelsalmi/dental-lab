"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FileCheck2, UploadCloud, WifiOff } from "lucide-react";
import { uploadToDrive } from "@/lib/driveUploadClient";

type Progress = {
  fileName: string;
  index: number;
  count: number;
  sent: number;
  size: number;
  speed: number;
  offline: boolean;
  drops: number;
};

function mb(bytes: number) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

// A file box that, when its form is submitted, first sends the chosen files
// straight to the case's Drive folder (with a progress screen, resuming after
// a dropped connection), then submits the form with only their Drive ids
// (as `<name>__uploaded`). `purpose` decides the folder (see /api/drive-upload).
export function DirectFileField({
  name,
  purpose,
  caseId,
  required,
  multiple,
  hint,
}: {
  name: string;
  purpose: string;
  caseId?: string;
  required?: boolean;
  multiple?: boolean;
  hint: string;
}) {
  const [label, setLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Drive ids of the uploaded files, sent with the form.
  const [uploadedIds, setUploadedIds] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = useRef(false);

  useEffect(() => {
    const form = fileInput.current?.form;
    if (!form) return;

    async function onSubmit(event: SubmitEvent) {
      const files = Array.from(fileInput.current?.files ?? []);
      if (ready.current || files.length === 0) {
        ready.current = false;
        return; // nothing to upload (or already uploaded): submit normally
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitter = event.submitter as HTMLElement | null;
      setError(null);

      const warn = (e: BeforeUnloadEvent) => e.preventDefault();
      window.addEventListener("beforeunload", warn);
      try {
        const ids: string[] = [];
        const data = new FormData(form!);
        for (const [index, file] of files.entries()) {
          const started = Date.now();
          let drops = 0;
          const base = { fileName: file.name, index, count: files.length, size: file.size, sent: 0, speed: 0, offline: false, drops };
          setProgress(base);
          const res = await fetch("/api/drive-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              purpose,
              caseId,
              name: file.name,
              size: file.size,
              type: file.type,
              subfolder: data.get("subfolder") || undefined,
              doctorId: data.get("doctorId"),
              newDoctorName: data.get("newDoctorName"),
              patientName: data.get("patientName"),
            }),
          }).catch(() => null);
          const json = res ? await res.json().catch(() => ({})) : {};
          if (!res?.ok || !json.uploadUrl) throw new Error(json.error ?? "Could not start the upload. Check the internet and try again.");

          const id = await uploadToDrive(json.uploadUrl, file, {
            onProgress: (sent) => {
              const secs = (Date.now() - started) / 1000;
              setProgress((p) => (p ? { ...p, sent, speed: secs > 0.5 ? sent / secs : p.speed } : p));
            },
            onConnectionLost: () => {
              drops++;
              setProgress((p) => (p ? { ...p, offline: true, drops } : p));
            },
            onResumed: () => setProgress((p) => (p ? { ...p, offline: false } : p)),
          });
          ids.push(id);
        }
        // The files are in Drive: send the form with only their ids (the
        // page is redrawn first so the ids are in it).
        if (fileInput.current) fileInput.current.value = "";
        flushSync(() => {
          setUploadedIds(JSON.stringify(ids));
          setProgress(null);
        });
        ready.current = true;
        form!.requestSubmit(submitter instanceof HTMLButtonElement ? submitter : undefined);
      } catch (e) {
        setProgress(null);
        setError((e as Error).message);
      } finally {
        window.removeEventListener("beforeunload", warn);
      }
    }

    const handler = (e: Event) => void onSubmit(e as SubmitEvent);
    form.addEventListener("submit", handler, { capture: true });
    return () => form.removeEventListener("submit", handler, { capture: true });
  }, [purpose, caseId]);

  const p = progress;
  const pct = p && p.size ? Math.floor((p.sent / p.size) * 100) : 0;
  const left = p && p.speed > 0 ? (p.size - p.sent) / p.speed : NaN;

  return (
    <>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center transition-colors hover:border-brand/40 hover:bg-brand-soft/40">
        {label ? (
          <>
            <FileCheck2 className="text-brand" size={24} />
            <span className="text-sm font-medium text-slate-900">{label}</span>
            <span className="text-xs text-slate-400">Click to choose a different file</span>
          </>
        ) : (
          <>
            <UploadCloud className="text-slate-400" size={24} />
            <span className="text-sm font-medium text-slate-600">Click to attach a file</span>
            <span className="text-xs text-slate-400">{hint}</span>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          required={required}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files;
            ready.current = false;
            setUploadedIds("");
            setError(null);
            setLabel(!files || files.length === 0 ? null : files.length === 1 ? files[0].name : `${files.length} files`);
          }}
        />
        <input type="hidden" name={`${name}__uploaded`} value={uploadedIds} readOnly />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {p && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">
              Uploading to Google Drive{p.count > 1 ? ` (${p.index + 1} of ${p.count})` : ""}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{p.fileName}</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full transition-all ${p.offline ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-700">
              <strong>{pct}%</strong> · {mb(p.sent)} of {mb(p.size)}
              {!p.offline && p.speed > 0 && (
                <span className="text-slate-500">
                  {" "}
                  · {mb(p.speed)}/s · about {duration(left)} left
                </span>
              )}
            </p>
            {p.offline ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700">
                <WifiOff size={14} /> Connection lost. It will continue from {pct}% when the internet is back.
              </p>
            ) : p.drops > 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Recovered from {p.drops} dropped connection{p.drops === 1 ? "" : "s"}.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-400">Keep this page open until it finishes.</p>
          </div>
        </div>
      )}
    </>
  );
}
