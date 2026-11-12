"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronUp, UploadCloud, WifiOff, X, XCircle } from "lucide-react";
import { uploadToDrive } from "@/lib/driveUploadClient";
import { runUploadStep } from "@/app/cases/uploadSteps";

// Uploads run in the background (this lives in the root layout, so it keeps
// going while people move around the system): each job sends its files
// straight to Drive, then runs the step its form was for.

export type UploadJob = {
  id: string;
  title: string; // e.g. "Submit for review · Ahmed Khamis"
  step: string; // purpose / step key (see /api/drive-upload and runUploadStep)
  caseId?: string;
  fieldName: string;
  files: File[];
  formData: FormData;
  linkBody: Record<string, unknown>;
};

type JobState = {
  job: UploadJob;
  status: "waiting" | "uploading" | "offline" | "finishing" | "done" | "error";
  fileIndex: number;
  sent: number;
  size: number;
  speed: number;
  message?: string;
  href?: string;
};

type Ctx = {
  enqueue: (job: UploadJob) => void;
  isBusy: (caseId: string | undefined, step: string) => boolean;
};

const UploadContext = createContext<Ctx | null>(null);

export function useUploads() {
  return useContext(UploadContext);
}

function mb(bytes: number) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<JobState[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const running = useRef(false);
  const queue = useRef<JobState[]>([]);
  const router = useRouter();

  function update(id: string, patch: Partial<JobState>) {
    setJobs((list) => list.map((j) => (j.job.id === id ? { ...j, ...patch } : j)));
    const q = queue.current.find((j) => j.job.id === id);
    if (q) Object.assign(q, patch);
  }

  async function runNext(): Promise<void> {
    if (running.current) return;
    const next = queue.current.find((j) => j.status === "waiting");
    if (!next) return;
    running.current = true;
    const { job } = next;
    try {
      const ids: string[] = [];
      for (const [fileIndex, file] of job.files.entries()) {
        const started = Date.now();
        update(job.id, { status: "uploading", fileIndex, sent: 0, size: file.size, speed: 0 });
        const res = await fetch("/api/drive-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...job.linkBody, purpose: job.step, caseId: job.caseId, name: file.name, size: file.size, type: file.type }),
        }).catch(() => null);
        const json = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok || !json.uploadUrl) throw new Error(json.error ?? "Could not start the upload. Check the internet and try again.");
        ids.push(
          await uploadToDrive(json.uploadUrl, file, {
            onProgress: (sent) => {
              const secs = (Date.now() - started) / 1000;
              update(job.id, { sent, ...(secs > 1 ? { speed: sent / secs } : {}) });
            },
            onConnectionLost: () => update(job.id, { status: "offline" }),
            onResumed: () => update(job.id, { status: "uploading" }),
          })
        );
      }
      update(job.id, { status: "finishing" });
      const data = new FormData();
      for (const [k, v] of job.formData.entries()) data.append(k, v);
      data.set(`${job.fieldName}__uploaded`, JSON.stringify(ids));
      const result = await runUploadStep(job.step, data);
      if (!result.ok) throw new Error(result.error);
      const caseId = result.caseId ?? job.caseId;
      update(job.id, { status: "done", href: caseId ? `/cases/${caseId}` : undefined });
      router.refresh();
    } catch (error) {
      update(job.id, { status: "error", message: (error as Error).message });
    } finally {
      running.current = false;
      void runNext();
    }
  }

  function enqueue(job: UploadJob) {
    const state: JobState = { job, status: "waiting", fileIndex: 0, sent: 0, size: job.files[0]?.size ?? 0, speed: 0 };
    queue.current.push(state);
    setJobs((list) => [...list, state]);
    setCollapsed(false);
    void runNext();
  }

  const retry = (id: string) => {
    update(id, { status: "waiting", message: undefined, sent: 0 });
    void runNext();
  };
  const dismiss = (id: string) => {
    queue.current = queue.current.filter((j) => j.job.id !== id);
    setJobs((list) => list.filter((j) => j.job.id !== id));
  };

  const active = jobs.some((j) => ["waiting", "uploading", "offline", "finishing"].includes(j.status));
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  function isBusy(caseId: string | undefined, step: string) {
    return queue.current.some(
      (j) => j.job.step === step && j.job.caseId === caseId && ["waiting", "uploading", "offline", "finishing"].includes(j.status)
    );
  }

  return (
    <UploadContext.Provider value={{ enqueue, isBusy }}>
      {children}
      {jobs.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl print:hidden">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-900"
          >
            <span className="flex items-center gap-2">
              <UploadCloud size={16} className="text-brand" />
              {active ? "Uploading in the background" : "Uploads finished"}
            </span>
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {!collapsed && (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {jobs.map((j) => {
                const pct = j.size ? Math.floor((j.sent / j.size) * 100) : 0;
                const left = j.speed > 0 ? (j.size - j.sent) / j.speed : NaN;
                const file = j.job.files[j.fileIndex];
                return (
                  <li key={j.job.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{j.job.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {file?.name}
                          {j.job.files.length > 1 ? ` (${j.fileIndex + 1} of ${j.job.files.length})` : ""}
                        </p>
                      </div>
                      {(j.status === "done" || j.status === "error") && (
                        <button type="button" onClick={() => dismiss(j.job.id)} aria-label="Close" className="text-slate-400 hover:text-slate-700">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    {["waiting", "uploading", "offline", "finishing"].includes(j.status) && (
                      <>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full transition-all ${j.status === "offline" ? "bg-amber-500" : "bg-brand"}`}
                            style={{ width: `${j.status === "finishing" ? 100 : pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {j.status === "waiting" && "Waiting for the upload before it…"}
                          {j.status === "finishing" && "Saving to the case…"}
                          {j.status === "uploading" && (
                            <>
                              {pct}% · {mb(j.sent)} of {mb(j.size)}
                              {j.speed > 0 && ` · about ${duration(left)} left`}
                            </>
                          )}
                          {j.status === "offline" && (
                            <span className="flex items-center gap-1 text-amber-700">
                              <WifiOff size={12} /> Connection lost; continues from {pct}% when it&apos;s back
                            </span>
                          )}
                        </p>
                      </>
                    )}
                    {j.status === "done" && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
                        <CheckCircle2 size={13} /> Done.
                        {j.href && (
                          <Link href={j.href} className="font-medium underline">
                            Open case
                          </Link>
                        )}
                      </p>
                    )}
                    {j.status === "error" && (
                      <div className="mt-1 text-xs text-rose-700">
                        <p className="flex items-start gap-1.5">
                          <XCircle size={13} className="mt-px shrink-0" /> {j.message}
                        </p>
                        <button type="button" onClick={() => retry(j.job.id)} className="mt-1 font-medium underline">
                          Try again
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {active && !collapsed && (
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              You can keep working. Don&apos;t close or reload this tab until it finishes.
            </p>
          )}
        </div>
      )}
    </UploadContext.Provider>
  );
}
