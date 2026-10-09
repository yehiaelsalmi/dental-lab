import Link from "next/link";
import { Bell } from "lucide-react";
import { can, getAccess, toRoleAccess, type Access } from "@/lib/access";
import { LAB_LEADER_KEY } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getLabSettings } from "@/lib/labSettings";
import { LabMark } from "@/components/LabMark";
import { SidebarNav, type NavHref, type TeamLink } from "@/components/SidebarNav";
import { SignOutButton } from "@/components/SignOutButton";
import { MobileMenu } from "@/components/MobileMenu";

function visibleLinks(access: Access): NavHref[] {
  const links: [NavHref, boolean][] = [
    ["/cases", true],
    // Leaders who see all money use Reports instead.
    ["/earnings", can(access, "money.viewOwn") && !can(access, "money.viewAll")],
    ["/reports", can(access, "page.reports")],
    ["/invoices", can(access, "page.invoices")],
    ["/expenses", can(access, "page.expenses")],
    ["/payments", can(access, "money.payments")],
    ["/doctors", can(access, "page.doctors")],
    ["/users", can(access, "page.users")],
    ["/settings/roles", can(access, "page.roles")],
    ["/settings/statuses", can(access, "page.statuses")],
    ["/settings/checklists", can(access, "page.checklists")],
    ["/settings/fields", can(access, "page.fields")],
    ["/settings/pricing", can(access, "page.pricing")],
    ["/settings/google", can(access, "page.drive")],
    ["/settings/lab", can(access, "page.settings")],
  ];
  return links.filter(([, ok]) => ok).map(([href]) => href);
}

// The Team dropdown: Designers, Ceramists, then a page per other role (not the
// Lab Leader, and not roles already covered by the designer/ceramist pages).
async function teamLinks(access: Access): Promise<TeamLink[]> {
  const links: TeamLink[] = [];
  if (can(access, "page.designers")) links.push({ href: "/designers", label: "Designers" });
  if (can(access, "page.ceramists")) links.push({ href: "/ceramists", label: "Ceramists" });
  if (can(access, "page.team")) {
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
    for (const role of roles) {
      if (role.key === LAB_LEADER_KEY) continue;
      const perms = toRoleAccess(role).permissions;
      if (perms.has("work.design") || perms.has("work.ceramist")) continue;
      links.push({ href: `/team/${role.id}`, label: role.name });
    }
  }
  return links;
}

export async function Nav() {
  const access = await getAccess();
  if (!access) return null;

  const { email } = access;
  const name = access.name || email || "?";
  const show = visibleLinks(access);
  const team = await teamLinks(access);
  const lab = await getLabSettings();
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const unreadCount = await prisma.notification.count({
    where: { userId: access.userId, read: false },
  });

  const logo = (
    <div className="flex min-w-0 items-center gap-2.5">
      <LabMark lab={lab} size={36} />
      <p className="min-w-0 truncate text-sm font-semibold leading-tight text-slate-900 md:whitespace-normal">
        {lab.name}
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
              <SidebarNav show={show} team={team} />
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
          <SidebarNav show={show} team={team} />
        </div>
        {account}
      </aside>
    </>
  );
}
