"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

// Only same-site paths, so the login page can't be used to bounce people to
// another website.
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/cases";
}

export async function loginAction(formData: FormData) {
  const next = safeNext(formData);
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: next,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
}

export async function loginWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeNext(formData) });
}
