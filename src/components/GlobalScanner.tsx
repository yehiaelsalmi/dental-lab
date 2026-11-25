"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// USB/Bluetooth scanners "type" the code very fast and press Enter. Anywhere in
// the system (when no text box has focus), such a burst opens what was
// scanned: an inventory label opens its item, a case sheet QR opens the case.
// On a page with a scan box (e.g. Materials used on a case), an inventory code
// goes into that box instead.
const MAX_GAP_MS = 60; // scanners send keys a few ms apart; people type slower
const MIN_LENGTH = 6;

function editable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

export function GlobalScanner() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    let buffer = "";
    let last = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || editable(document.activeElement)) {
        buffer = "";
        return;
      }
      const now = performance.now();
      if (now - last > MAX_GAP_MS) buffer = "";
      last = now;

      if (e.key === "Enter" || e.key === "Tab") {
        const code = buffer;
        buffer = "";
        if (code.length < MIN_LENGTH) return;
        e.preventDefault();
        const stock = code.toUpperCase().match(/(INV|BLK)\d{3,}/)?.[0];
        const target = document.querySelector<HTMLInputElement>("input[data-scan-target]");
        if (stock && target) {
          target.value = stock;
          const next = target.form?.querySelector<HTMLInputElement>("input[name='quantity']");
          (next ?? target).focus();
          target.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }
        router.push(`/scan?code=${encodeURIComponent(code)}`);
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return null;
}
