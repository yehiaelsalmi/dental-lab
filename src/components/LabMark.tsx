import type { LabSettings } from "@/lib/labSettings";

// The lab's logo (uploaded in Lab settings), or a tooth mark in the brand
// colour when no logo is set.
export function LabMark({ lab, size = 36 }: { lab: LabSettings; size?: number }) {
  if (lab.logoDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={lab.logoDataUrl}
        alt={lab.name}
        width={size}
        height={size}
        className="shrink-0 rounded-lg bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
      aria-label={lab.name}
      role="img"
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5.5c-1.4-1.1-2.9-1.6-4.4-1.4C5.3 4.4 4 6.4 4 8.9c0 1.9.6 3.4 1.2 5 .6 1.6.9 3.4 1.2 5.2.2 1.1.8 1.9 1.6 1.9.9 0 1.3-.8 1.6-2l.8-3.3c.2-.8.8-1.3 1.6-1.3s1.4.5 1.6 1.3l.8 3.3c.3 1.2.7 2 1.6 2 .8 0 1.4-.8 1.6-1.9.3-1.8.6-3.6 1.2-5.2.6-1.6 1.2-3.1 1.2-5 0-2.5-1.3-4.5-3.6-4.8-1.5-.2-3 .3-4.4 1.4Z" />
        <path d="M9.5 7.2c.8.5 1.6.8 2.5.8" opacity="0.7" />
      </svg>
    </div>
  );
}
