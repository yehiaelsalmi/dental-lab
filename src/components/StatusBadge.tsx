import { CASE_STATUS_LABELS, type CaseStatus } from "@/lib/constants";

const STYLES: Record<CaseStatus, string> = {
  IBAR_DESIGN: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20",
  READY_FOR_DESIGN: "bg-sky-50 text-sky-700 ring-sky-600/20",
  IN_DESIGN: "bg-amber-50 text-amber-700 ring-amber-600/20",
  MATCHING: "bg-teal-50 text-teal-700 ring-teal-600/20",
  WAITING_FOR_REVIEW: "bg-violet-50 text-violet-700 ring-violet-600/20",
  CHANGES_REQUESTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  MILLING: "bg-orange-50 text-orange-700 ring-orange-600/20",
  STAIN_AND_GLAZE: "bg-pink-50 text-pink-700 ring-pink-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  DELIVERED: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

const DOT_STYLES: Record<CaseStatus, string> = {
  IBAR_DESIGN: "bg-fuchsia-500",
  READY_FOR_DESIGN: "bg-sky-500",
  IN_DESIGN: "bg-amber-500",
  MATCHING: "bg-teal-500",
  WAITING_FOR_REVIEW: "bg-violet-500",
  CHANGES_REQUESTED: "bg-rose-500",
  MILLING: "bg-orange-500",
  STAIN_AND_GLAZE: "bg-pink-500",
  COMPLETED: "bg-emerald-500",
  DELIVERED: "bg-slate-500",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status]}`} />
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}
