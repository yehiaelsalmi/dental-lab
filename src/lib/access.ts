import { cache } from "react";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  LAB_LEADER_KEY,
  LAB_LEADER_PERMISSIONS,
  PERMISSION_KEYS,
  type CaseScope,
  type Permission,
} from "@/lib/permissions";

export type RoleAccess = {
  id: string;
  key: string | null;
  name: string;
  permissions: Set<Permission>;
  caseScope: CaseScope;
  visibleStatuses: string[]; // empty = every status (built-in or custom keys)
  notifyOn: string[];
};

export type Access = {
  userId: string;
  name: string;
  email: string;
  role: RoleAccess;
};

function parseList(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// Turns a stored role into checked, typed access. The Lab Leader role always
// gets everything, whatever is stored.
export function toRoleAccess(role: {
  id: string;
  key: string | null;
  name: string;
  permissions: string;
  caseScope: string;
  visibleStatuses: string;
  notifyOn: string;
}): RoleAccess {
  const isLeader = role.key === LAB_LEADER_KEY;
  const scope = ["ALL", "OWN", "PHOTOGRAMMETRY"].includes(role.caseScope)
    ? (role.caseScope as CaseScope)
    : "ALL";
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    permissions: new Set(
      isLeader
        ? LAB_LEADER_PERMISSIONS
        : (parseList(role.permissions).filter((p) =>
            (PERMISSION_KEYS as string[]).includes(p)
          ) as Permission[])
    ),
    caseScope: isLeader ? "ALL" : scope,
    visibleStatuses: isLeader
      ? []
      : parseList(role.visibleStatuses),
    notifyOn: parseList(role.notifyOn),
  };
}

// Permissions are read fresh from the database on every request, so a role
// change applies immediately without signing out. Cached per request.
export const getAccess = cache(async (): Promise<Access | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || !user.active) return null;

  return { userId: user.id, name: user.name, email: user.email, role: toRoleAccess(user.role) };
});

export async function requireAccess(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/login");
  return access;
}

export function can(access: Access, permission: Permission): boolean {
  return access.role.permissions.has(permission);
}

// Passes if the user has any one of the permissions.
export async function requirePermission(...permissions: Permission[]): Promise<Access> {
  const access = await requireAccess();
  if (!permissions.some((p) => can(access, p))) redirect("/cases?error=forbidden");
  return access;
}

export function isLabLeader(access: Access): boolean {
  return access.role.key === LAB_LEADER_KEY;
}

type VisibilityFields = {
  status: string;
  needsPhotogrammetry: boolean;
  assignedDesignerId: string | null;
  firstDesignerId: string | null;
  ceramistId: string | null;
  // People assigned through an assignable role (milling, printing, ...).
  assignments?: { userId: string }[];
};

// Include this when loading a case that goes through canViewCase.
export const VISIBILITY_INCLUDE = { assignments: { select: { userId: true } } } as const;

export function canViewCase(access: Access, c: VisibilityFields): boolean {
  const { caseScope, visibleStatuses } = access.role;
  if (visibleStatuses.length > 0 && !visibleStatuses.includes(c.status)) return false;
  if (caseScope === "OWN") {
    return (
      [c.assignedDesignerId, c.firstDesignerId, c.ceramistId].includes(access.userId) ||
      (c.assignments ?? []).some((a) => a.userId === access.userId)
    );
  }
  if (caseScope === "PHOTOGRAMMETRY") return c.needsPhotogrammetry;
  return true;
}

// The same rule as canViewCase, as a database filter.
export function caseVisibilityWhere(access: Access): Prisma.CaseWhereInput {
  const { caseScope, visibleStatuses } = access.role;
  const filters: Prisma.CaseWhereInput[] = [];
  if (visibleStatuses.length > 0) filters.push({ status: { in: visibleStatuses } });
  if (caseScope === "OWN") {
    filters.push({
      OR: [
        { assignedDesignerId: access.userId },
        { firstDesignerId: access.userId },
        { ceramistId: access.userId },
        { assignments: { some: { userId: access.userId } } },
      ],
    });
  }
  if (caseScope === "PHOTOGRAMMETRY") filters.push({ needsPhotogrammetry: true });
  return filters.length > 0 ? { AND: filters } : {};
}

// Loads a case the user is allowed to see, or redirects with an error.
export async function requireVisibleCase(access: Access, caseId: string) {
  const caseRecord = await prisma.case.findUnique({ where: { id: caseId }, include: VISIBILITY_INCLUDE });
  if (!caseRecord || !canViewCase(access, caseRecord)) {
    throw new Error("You don't have access to this case.");
  }
  return caseRecord;
}

// Active users whose role has a permission (e.g. who can be assigned as
// designer, or who should hear that a case is ready for review).
export async function usersWithPermission(permission: Permission) {
  const users = await prisma.user.findMany({
    where: { active: true },
    include: { role: true },
    orderBy: { name: "asc" },
  });
  return users.filter((u) => toRoleAccess(u.role).permissions.has(permission));
}
