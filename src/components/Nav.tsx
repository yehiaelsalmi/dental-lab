import Link from "next/link";
import { Bell } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LAB_INITIALS, LAB_NAME } from "@/lib/constants";
import { SidebarNav } from "@/components/SidebarNav";
import { SignOutButton } from "@/components/SignOutButton";
import { MobileMenu } from "@/components/MobileMenu";

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

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  const logo = (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
        {LAB_INITIALS}
      </div>
      <p className="min-w-0 truncate text-sm font-semibold leading-tight text-slate-900 md:whitespace-normal">
        {LAB_NAME}
      </p>
    </div>
  );

  const bell = (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:h-8 md:w-8"
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );

  const account = (
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
  );

  return (
    <>
      {/* Phones and small tablets: top bar with a menu button. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 md:hidden print:hidden">
        <div className="flex min-w-0 items-center gap-1">
          <MobileMenu>
            <div className="flex-1 py-2">
              <SidebarNav role={role} />
            </div>
            {account}
          </MobileMenu>
          {logo}
        </div>
        {bell}
      </header>

      {/* Desktop: fixed sidebar. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex print:hidden">
        <div className="flex items-center justify-between gap-2.5 border-b border-slate-100 px-5 py-5">
          {logo}
          {bell}
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav role={role} />
        </div>
        {account}
      </aside>
    </>
  );
}
