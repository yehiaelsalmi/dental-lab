import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  APPROVAL_ROUTES,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  type ApprovalRoute,
  type CaseStatus,
} from "@/lib/constants";

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
  WAITING_FOR_REVIEW: "violet",
  CHANGES_REQUESTED: "rose",
  PRINTING: "cyan",
  MILLING: "orange",
  TRY_IN: "lime",
  MATCHING: "teal",
  REDESIGN: "indigo",
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
  // Built-in statuses the lab hid; the workflow skips them.
  hidden?: boolean;
};

export function isBuiltInStatus(key: string): key is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(key);
}

// AppSetting key prefix for renamed built-in statuses.
export const BUILT_IN_LABEL_PREFIX = "status.label.";
// AppSetting keys (JSON arrays of status keys): the display order the lab set,
// and the built-in statuses it hid.
export const STATUS_ORDER_KEY = "status.order";
export const STATUS_HIDDEN_KEY = "status.hidden";

// These carry the workflow and can't be hidden.
export const UNHIDEABLE_STATUSES: CaseStatus[] = ["IBAR_DESIGN", "WAITING_FOR_REVIEW", "DELIVERED"];

// Where the workflow goes instead of a hidden status. Printing, milling and
// try-in have no stand-in: hiding them removes the approval choices that use
// them (see availableRoutes).
const SKIP_TO: Partial<Record<CaseStatus, CaseStatus>> = {
  READY_FOR_DESIGN: "IN_DESIGN",
  IN_DESIGN: "READY_FOR_DESIGN",
  CHANGES_REQUESTED: "IN_DESIGN",
  MATCHING: "REDESIGN",
  REDESIGN: "IN_DESIGN",
  STAIN_AND_GLAZE: "COMPLETED",
  COMPLETED: "DELIVERED",
};

function parseKeys(value: string | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

// The lab's saved order; statuses it doesn't mention yet (e.g. a new custom
// status) go right after the status before them in the default order.
function applyOrder(list: StatusInfo[], order: string[]): StatusInfo[] {
  if (order.length === 0) return list;
  const result = order.flatMap((k) => list.filter((s) => s.key === k));
  list.forEach((s, i) => {
    if (result.includes(s)) return;
    const prev = list.slice(0, i).reverse().find((p) => result.includes(p));
    result.splice(prev ? result.indexOf(prev) + 1 : 0, 0, s);
  });
  return result;
}

// Every status (hidden ones included) in display order. Cached per request.
export const getAllStatuses = cache(async (): Promise<StatusInfo[]> => {
  const [custom, settings] = await Promise.all([
    prisma.customStatus.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appSetting.findMany({ where: { key: { startsWith: "status." } } }),
  ]);
  const renamed = settings.filter((r) => r.key.startsWith(BUILT_IN_LABEL_PREFIX));
  const hidden = parseKeys(settings.find((r) => r.key === STATUS_HIDDEN_KEY)?.value);
  const order = parseKeys(settings.find((r) => r.key === STATUS_ORDER_KEY)?.value);
  // The lab can rename built-in statuses (e.g. Completed -> Revision).
  const nameOf = (key: CaseStatus) =>
    renamed.find((r) => r.key === BUILT_IN_LABEL_PREFIX + key)?.value || CASE_STATUS_LABELS[key];
  const list: StatusInfo[] = CASE_STATUSES.map((key) => ({
    key,
    label: nameOf(key),
    color: BUILT_IN_COLORS[key],
    builtIn: true,
    hidden: hidden.includes(key) && !UNHIDEABLE_STATUSES.includes(key),
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
  return applyOrder(list, order);
});

// The statuses people work with: everything except hidden built-ins.
export const getStatuses = cache(async (): Promise<StatusInfo[]> =>
  (await getAllStatuses()).filter((s) => !s.hidden)
);

export const hiddenStatuses = cache(async (): Promise<Set<string>> =>
  new Set((await getAllStatuses()).filter((s) => s.hidden).map((s) => s.key))
);

// The status a workflow step should move to, skipping hidden ones.
export function resolveStatus(target: CaseStatus, hidden: Set<string>): CaseStatus {
  let status = target;
  for (let i = 0; i < 5 && hidden.has(status) && SKIP_TO[status]; i++) status = SKIP_TO[status]!;
  return status;
}

export async function nextStatus(target: CaseStatus): Promise<CaseStatus> {
  return resolveStatus(target, await hiddenStatuses());
}

// Approval choices whose statuses are all visible.
export function availableRoutes(hidden: Set<string>): ApprovalRoute[] {
  const needs: Record<ApprovalRoute, CaseStatus[]> = {
    PRINT_TRYIN: ["PRINTING", "TRY_IN"],
    PRINT: ["PRINTING"],
    MILL: ["MILLING"],
  };
  return (Object.keys(APPROVAL_ROUTES) as ApprovalRoute[]).filter((r) => needs[r].every((k) => !hidden.has(k)));
}

// Why a built-in status can't be hidden right now, or null if it can.
export function cannotHide(key: CaseStatus, hidden: Set<string>): string | null {
  if (UNHIDEABLE_STATUSES.includes(key)) return "This status carries the workflow and can't be hidden.";
  const after = new Set([...hidden, key]);
  if (after.has("READY_FOR_DESIGN") && after.has("IN_DESIGN")) {
    return "Ready for Design and In Design can't both be hidden.";
  }
  if (availableRoutes(after).length === 0) return "At least one of Printing or Milling has to stay.";
  return null;
}

// Looks a status up in `list` (hidden ones too when given getAllStatuses()).
export function findStatus(list: StatusInfo[], key: string): StatusInfo {
  return (
    list.find((s) => s.key === key) ?? { key, label: key, color: "slate", builtIn: false }
  );
}

export async function statusLabel(key: string): Promise<string> {
  return findStatus(await getAllStatuses(), key).label;
}

// Status key -> display name, for components that only need the names.
export async function statusLabels(): Promise<Record<string, string>> {
  return Object.fromEntries((await getStatuses()).map((s) => [s.key, s.label]));
}
