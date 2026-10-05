import Link from "next/link";
import { KeyRound } from "lucide-react";
import { LAB_INITIALS, LAB_NAME } from "@/lib/constants";
import { loginAction, loginWithGoogle } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Invalid email or password.",
  not_registered:
    "That Google account isn't set up yet. Ask your Lab Leader to add you as a user first.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white shadow-lg shadow-brand/30">
            {LAB_INITIALS}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{LAB_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage cases</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {ERROR_MESSAGES[error] ?? "Something went wrong signing you in."}
            </p>
          )}

          {googleConfigured && (
            <>
              <form action={loginWithGoogle}>
                {next && <input type="hidden" name="next" value={next} />}
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <GoogleIcon />
                  Sign in with Google
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                or
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}

          <form action={loginAction} className="flex flex-col gap-4">
            {next && <input type="hidden" name="next" value={next} />}
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                name="email"
                required
                autoFocus={!googleConfigured}
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

        <p className="mt-4 text-center text-xs text-slate-400">
          <Link href="/privacy" className="hover:text-slate-600">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
