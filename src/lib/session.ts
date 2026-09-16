import { auth } from "@/auth";
import type { Role } from "@/lib/constants";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    redirect("/cases?error=forbidden");
  }
  return session;
}
