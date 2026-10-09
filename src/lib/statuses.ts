import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { CASE_STATUSES, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/constants";

// Colours a custom status can use. Full class names are spelled out so
// Tailwind keeps them.
export const STATUS_COLORS = {
  slate: { badge: "bg-slate-100 text-slate-700 ring-slate-500/20", dot: "bg-slate-500" },
  sky: { badge: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  amber: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  teal: { badge: "bg-teal-50 text-teal-700 ring-teal-600/20", dot: "bg-teal-500" },
  violet: { badge: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
  rose: { badge: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
  orange: { badge: "bg-orange-50 text-orange-700 ring-orange-600/20", dot: "bg-orange-500" },
  pink: { badge: "bg-pink-50 text-pink-700 ring-pink-600/20", dot: "bg-pink-500" },
  emerald: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  fuchsia: { badge: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20", dot: "bg-fuchsia-500" },
  lime: { badge: "bg-lime-50 text-lime-700 ring-lime-600/20", dot: "bg-lime-500" },
  cyan: { badge: "bg-cyan-50 text-cyan-700 ring-cyan-600/20", dot: "bg-cyan-500" },
  indigo: { badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/20", dot: "bg-indigo-500" },
} as const;
export type StatusColor = keyof typeof STATUS_COLORS;
export const STATUS_COLOR_KEYS = Object.keys(STATUS_COLORS) as StatusColor[];

const BUILT_IN_COLORS: Record<CaseStatus, StatusColor> = {
  READY_FOR_DESIGN: "sky",
  IBAR_DESIGN: "fuchsia",
  IN_DESIGN: "amber",
  MATCHING: "teal",
  WAITING_FOR_REVIEW: "violet",
  CHANGES_REQUESTED: "rose",
  MILLING: "orange",
  STAIN_AND_GLAZE: "pink",
  COMPLETED: "emerald",
  DELIVERED: "slate",
};

export type StatusInfo = {
  key: string;
  label: string;
  color: StatusColor;
  builtIn: boolean;
  afterStatus?: string;
};

export function isBuiltInStatus(key: string): key is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(key);
}

// AppSetting key prefix for renamed built-in statuses.
export const BUILT_IN_LABEL_PREFIX = "status.label.";

// Every status in display order: the built-in workflow with each custom status
// placed right after the status it was attached to. Cached per request.
export const getStatuses = cache(async (): Promise<StatusInfo[]> => {
  const [custom, renamed] = await Promise.all([
    prisma.customStatus.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appSetting.findMany({ where: { key: { startsWith: BUILT_IN_LABEL_PREFIX } } }),
  ]);
  // The lab can rename built-in statuses (e.g. Completed -> Revision).
  const nameOf = (key: CaseStatus) =>
    renamed.find((r) => r.key === BUILT_IN_LABEL_PREFIX + key)?.value || CASE_STATUS_LABELS[key];
  const list: StatusInfo[] = CASE_STATUSES.map((key) => ({
    key,
    label: nameOf(key),
    color: BUILT_IN_COLORS[key],
    builtIn: true,
  }));

  const pending = custom.map((c) => ({
    key: c.key,
    label: c.label,
    color: (c.color in STATUS_COLORS ? c.color : "slate") as StatusColor,
    builtIn: false,
    afterStatus: c.afterStatus,
  }));
  // Insert in rounds so a custom status can follow another custom status.
  while (pending.length > 0) {
    const placeable = pending.findIndex((p) => list.some((s) => s.key === p.afterStatus));
    const next = pending.splice(placeable === -1 ? 0 : placeable, 1)[0];
    const anchor = list.findIndex((s) => s.key === next.afterStatus);
    // Several statuses after the same anchor keep their creation order.
    let at = anchor === -1 ? list.length : anchor + 1;
    while (at < list.length && !list[at].builtIn && list[at].afterStatus === next.afterStatus) at++;
    list.splice(at, 0, next);
  }
  return list;
});

export function findStatus(list: StatusInfo[], key: string): StatusInfo {
  return (
    list.find((s) => s.key === key) ?? { key, label: key, color: "slate", builtIn: false }
  );
}

export async function statusLabel(key: string): Promise<string> {
  return findStatus(await getStatuses(), key).label;
}

// Status key -> display name, for components that only need the names.
export async function statusLabels(): Promise<Record<string, string>> {
  return Object.fromEntries((await getStatuses()).map((s) => [s.key, s.label]));
}
