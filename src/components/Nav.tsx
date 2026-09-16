import Link from "next/link";
import { auth } from "@/auth";
import { SidebarNav } from "@/components/SidebarNav";
import { SignOutButton } from "@/components/SignOutButton";

export async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  const { role, email } = session.user;
  const name = session.user.name ?? email ?? "?";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          DL
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Dental Lab</p>
          <p className="text-xs text-slate-400">Case Management</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav role={role} />
      </div>

      <div className="border-t border-slate-100 p-3">
        <Link
          href="/account"
          className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-400">{email}</p>
          </div>
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
