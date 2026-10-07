import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/access";
import { RoleForm } from "@/components/RoleForm";
import { getStatuses } from "@/lib/statuses";
import { createRole } from "../actions";

export default async function NewRolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("page.roles");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href="/settings/roles"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to roles
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">New role</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <RoleForm
        statuses={await getStatuses()}
        action={createRole}
        submitLabel="Create role"
        values={{ name: "", permissions: [], caseScope: "ALL", visibleStatuses: [], notifyOn: [] }}
      />
    </div>
  );
}
