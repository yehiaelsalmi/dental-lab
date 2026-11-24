"use client";

import { useEffect, useRef } from "react";
import { ScanLine } from "lucide-react";

// The box a USB/Bluetooth scanner "types" into: scanners send the code and
// then Enter, which submits the search. It takes focus when the page opens,
// and characters typed while nothing else has focus are sent to it too, so
// a scan is never missed.
export function ScanBox({ defaultValue, grabTyping = true }: { defaultValue?: string; grabTyping?: boolean }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    if (!grabTyping) return;
    el.focus();
    el.select();
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const typingElsewhere =
        active && active !== el && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable);
      if (typingElsewhere || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && active !== el) {
        e.preventDefault();
        el.focus();
        el.value += e.key;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [grabTyping]);

  return (
    <form action="/inventory" className="flex gap-2">
      <div className="relative flex-1">
        <ScanLine size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand" />
        <input
          ref={input}
          name="scan"
          defaultValue={defaultValue}
          autoComplete="off"
          placeholder="Scan an item's QR label (or type its code or name) and press Enter"
          className="w-full rounded-lg border-2 border-brand/40 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <button type="submit" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
        Find
      </button>
    </form>
  );
}
