import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/access";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  changeUserRoleAction,
  createUser,
  deleteUserAction,
  setSalaryAction,
  toggleUserActiveAction,
} from "./actions";

const SELECT_CLASS =
  "rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const access = await requirePermission("page.users");
  const { error, deleted } = await searchParams;

  const [users, roles] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const defaultRoleId = roles.find((r) => r.key === "DESIGNER")?.id ?? roles[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Users</h1>
      <p className="mb-6 text-sm text-slate-500">
        Manage who can sign in to the lab system and which role each person has.
        {can(access, "page.roles") && (
          <>
            {" "}
            <Link href="/settings/roles" className="font-medium text-brand hover:text-brand-hover">
              Manage roles
            </Link>
          </>
        )}
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {deleted && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {deleted} was deleted.
        </p>
      )}

      <section className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Salary / month</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-900">{u.name}</td>
                <td className="px-5 py-3.5 text-slate-500">{u.email}</td>
                <td className="px-5 py-3.5">
                  <form action={changeUserRoleAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <AutoSubmitSelect
                      name="roleId"
                      label={`Role for ${u.name}`}
                      defaultValue={u.roleId}
                      options={roleOptions}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand"
                    />
                  </form>
                </td>
                <td className="px-5 py-3.5">
                  <form action={setSalaryAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="userId" value={u.id} />
                    <input
                      name="baseSalary"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={u.baseSalary ?? ""}
                      placeholder="None"
                      aria-label={`Monthly salary for ${u.name}`}
                      className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand"
                    />
                    <button type="submit" className="text-xs font-medium text-slate-500 hover:text-brand">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                      u.active
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                        : "bg-slate-100 text-slate-500 ring-slate-400/20"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {u.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-4">
                    <form action={toggleUserActiveAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="nextActive" value={(!u.active).toString()} />
                      <button type="submit" className="text-xs font-medium text-slate-500 hover:text-brand hover:underline">
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                    {u.id !== access.userId && (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <ConfirmSubmitButton
                          message={`Delete ${u.name}? They won't be able to sign in any more. Their name stays on past cases.`}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <UserPlus size={16} />
          Add user
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          They can sign in with this email/password, or with Google using the same email address.
        </p>
        <form action={createUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Name
            <input
              name="name"
              required
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              name="email"
              required
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Role
            <select name="roleId" className={SELECT_CLASS} defaultValue={defaultRoleId}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="self-start sm:col-span-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            Create User
          </button>
        </form>
      </section>
    </div>
  );
}
