import Link from "next/link";
import { Pencil, Plus, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, toRoleAccess } from "@/lib/access";
import { CASE_SCOPES, LAB_LEADER_KEY } from "@/lib/permissions";
import { CASE_STATUS_LABELS } from "@/lib/constants";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requirePermission("page.roles");
  const { saved } = await searchParams;

  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Roles</h1>
          <p className="mt-1 text-sm text-slate-500">
            What each role can do and which cases it sees. Assign roles to people on the Users page.
          </p>
        </div>
        <Link
          href="/settings/roles/new"
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          <Plus size={16} />
          New role
        </Link>
      </div>

      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Role saved.</p>
      )}

      <div className="flex flex-col gap-3">
        {roles.map((role) => {
          const access = toRoleAccess(role);
          const isLeader = role.key === LAB_LEADER_KEY;
          const scope = CASE_SCOPES.find((s) => s.key === access.caseScope)?.label ?? "All cases";
          const statuses =
            access.visibleStatuses.length === 0
              ? "every status"
              : access.visibleStatuses.map((s) => CASE_STATUS_LABELS[s]).join(", ");
          return (
            <Link
              key={role.id}
              href={`/settings/roles/${role.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand/40 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  {role.name}
                  {isLeader && <Lock size={13} className="text-slate-400" />}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {isLeader
                    ? "Full access to everything"
                    : `${access.permissions.size} permission${access.permissions.size === 1 ? "" : "s"} · ${scope}, ${statuses}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm text-slate-500">
                <span>
                  {role._count.users} user{role._count.users === 1 ? "" : "s"}
                </span>
                <Pencil size={14} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
