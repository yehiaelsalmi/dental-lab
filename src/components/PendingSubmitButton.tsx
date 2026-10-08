"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// A submit button that shows progress while its form is being sent and can't
// be pressed twice (a second press would cancel a large upload in progress).
// With `overlay`, the whole screen shows an "uploading" message too.
export function PendingSubmitButton({
  children,
  pendingText = "Saving...",
  overlay = false,
  className,
  formAction,
}: {
  children: React.ReactNode;
  pendingText?: string;
  overlay?: boolean;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [pending]);

  // Warn before leaving the page while an upload is still going.
  useEffect(() => {
    if (!pending || !overlay) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, overlay]);

  return (
    <>
      <button
        type="submit"
        formAction={formAction}
        disabled={pending}
        aria-busy={pending}
        className={`${className ?? ""} inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-80`}
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {pending ? pendingText : children}
      </button>

      {pending && overlay && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <Loader2 size={36} className="mx-auto animate-spin text-brand" />
            <p className="mt-4 text-base font-semibold text-slate-900">{pendingText}</p>
            <p className="mt-1 text-sm text-slate-500">
              Large files can take a few minutes. Please keep this page open.
            </p>
            <p className="mt-3 font-mono text-xs text-slate-400">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
