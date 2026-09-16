import { KeyRound } from "lucide-react";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white shadow-lg shadow-brand/30">
            DL
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Dental Lab System</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage cases</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Invalid email or password.
            </p>
          )}

          <form action={loginAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                name="email"
                required
                autoFocus
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                name="password"
                required
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <button
              type="submit"
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
            >
              <KeyRound size={16} />
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
