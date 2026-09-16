import { KeyRound } from "lucide-react";
import { requireSession } from "@/lib/session";
import { changePassword } from "./actions";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireSession();
  const { error, success } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-8 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">My Account</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
        <dl className="flex flex-col gap-2.5">
          <div className="flex justify-between">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900">{session.user.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{session.user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium text-slate-900">{session.user.role.replace("_", " ")}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <KeyRound size={16} />
          Change password
        </h2>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password updated.
          </p>
        )}

        <form action={changePassword} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Current password
            <input
              type="password"
              name="currentPassword"
              required
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            New password
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
