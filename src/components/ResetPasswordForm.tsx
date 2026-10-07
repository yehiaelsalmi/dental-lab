"use client";

import { useState } from "react";

// Easy to read aloud or type on a phone: no 0/O, 1/l/I.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// The leader types a new password or generates one here, copies it to send to
// the person, then saves. The password never appears in a URL.
export function ResetPasswordForm({
  action,
  userId,
  userName,
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  userName: string;
}) {
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <form action={action} className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="userId" value={userId} />
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        New password for {userName} (at least 8 characters)
        <input
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setCopied(false);
          }}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-brand"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPassword(generatePassword());
            setCopied(false);
          }}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Generate
        </button>
        <button
          type="button"
          disabled={password.length === 0}
          onClick={async () => {
            await navigator.clipboard.writeText(password).catch(() => {});
            setCopied(true);
          }}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Set password
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Copy it before saving and send it to them; it won&apos;t be shown again.
      </p>
    </form>
  );
}
