import type { LabSettings } from "@/lib/labSettings";

// The lab's logo, or its initials in a coloured square when no logo is set.
export function LabMark({ lab, size = 36 }: { lab: LabSettings; size?: number }) {
  if (lab.logoDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={lab.logoDataUrl}
        alt={lab.name}
        width={size}
        height={size}
        className="shrink-0 rounded-lg object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {lab.initials}
    </div>
  );
}
