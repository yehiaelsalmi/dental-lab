import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, toRoleAccess } from "@/lib/access";
import { LAB_LEADER_KEY } from "@/lib/permissions";
import { RoleForm } from "@/components/RoleForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteRole, updateRole } from "../actions";

export default async function EditRolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("page.roles");
  const { id } = await params;
  const { error } = await searchParams;

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      users: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, active: true },
      },
    },
  });
  if (!role) notFound();

  const access = toRoleAccess(role);
  const locked = role.key === LAB_LEADER_KEY;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href="/settings/roles"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to roles
      </Link>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">{role.name}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {locked
          ? "The Lab Leader role always has full access, so nobody can be locked out. It can't be edited. Leaders aren't listed as designers or ceramists; give someone a designer or ceramist role for that work."
          : "Changes apply straight away to everyone with this role."}
        {role.users.length > 0 && (
          <> People with this role: {role.users.map((u) => u.name + (u.active ? "" : " (disabled)")).join(", ")}.</>
        )}
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <RoleForm
        action={updateRole}
        roleId={role.id}
        locked={locked}
        submitLabel="Save changes"
        values={{
          name: role.name,
          permissions: [...access.permissions],
          caseScope: access.caseScope,
          visibleStatuses: access.visibleStatuses,
          notifyOn: access.notifyOn,
        }}
      />

      {!locked && (
        <form action={deleteRole} className="mt-8">
          <input type="hidden" name="id" value={role.id} />
          <ConfirmSubmitButton
            message={`Delete the role "${role.name}"?`}
            className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            <Trash2 size={15} />
            Delete this role
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
