import { STATUS_COLORS, findStatus, getStatuses } from "@/lib/statuses";

// Works for built-in and custom statuses (custom ones carry their own label
// and colour).
export async function StatusBadge({ status }: { status: string }) {
  const info = findStatus(await getStatuses(), status);
  const color = STATUS_COLORS[info.color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${color.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
      {info.label}
    </span>
  );
}
