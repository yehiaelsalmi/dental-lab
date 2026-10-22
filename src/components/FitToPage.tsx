"use client";

import { useLayoutEffect, useRef } from "react";

// A fixed-size page whose text shrinks (via the --fit CSS variable, used in its
// font sizes) until everything fits, so a busy case still prints on one sheet.
export function FitToPage({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let fit = 1;
    el.style.setProperty("--fit", "1");
    while (el.scrollHeight > el.clientHeight + 1 && fit > 0.6) {
      fit = Math.round((fit - 0.03) * 100) / 100;
      el.style.setProperty("--fit", String(fit));
    }
  }, []);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
