import { KeyRound } from "lucide-react";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { changePassword, saveMyPhone } from "./actions";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; phoneSaved?: string; phoneError?: string }>;
}) {
  const session = await requireAccess();
  const { error, success, phoneSaved, phoneError } = await searchParams;
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });

  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">My Account</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
        <dl className="flex flex-col gap-2.5">
          <div className="flex justify-between">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900">{session.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{session.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium text-slate-900">{session.role.name}</dd>
          </div>
        </dl>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">WhatsApp number</h2>
        <p className="mb-4 text-xs text-slate-500">Notifications from the system are sent to this number on WhatsApp.</p>
        {phoneSaved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Number saved.</p>}
        {phoneError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{phoneError}</p>}
        <form action={saveMyPhone} className="flex gap-2">
          <input
            name="phone"
            type="tel"
            defaultValue={me?.phone ?? ""}
            placeholder="e.g. 01012345678"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button type="submit" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
            Save
          </button>
        </form>
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
