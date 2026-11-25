import Link from "next/link";
import { Bell } from "lucide-react";
import { can, getAccess, type Access } from "@/lib/access";
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
    ["/inventory", can(access, "page.inventory") || can(access, "inventory.use")],
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
  const showDesigners = can(access, "page.designers");
  const showCeramists = can(access, "page.ceramists");
  if (showDesigners) links.push({ href: "/designers", label: "Designers" });
  if (showCeramists) links.push({ href: "/ceramists", label: "Ceramists" });
  if (can(access, "page.team")) {
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
    for (const role of roles) {
      if (role.key === LAB_LEADER_KEY) continue;
      // The Designer and Ceramist roles already have their own pages above.
      const name = role.name.trim().toLowerCase();
      if (showDesigners && (role.key === "DESIGNER" || name === "designer" || name === "designers")) continue;
      if (showCeramists && (name === "ceramist" || name === "ceramists")) continue;
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

  const logo = (dark: boolean) => (
    <Link href="/cases" className="flex min-w-0 items-center gap-2.5">
      <LabMark lab={lab} size={36} />
      <span className="min-w-0">
        <span className={`block truncate text-sm font-semibold leading-tight md:whitespace-normal ${dark ? "text-white" : "text-slate-900"}`}>
          {lab.name}
        </span>
        <span className={`block text-[11px] font-medium ${dark ? "text-teal-300/80" : "text-slate-400"}`}>Dental lab system</span>
      </span>
    </Link>
  );

  const bell = (dark: boolean) => (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg md:h-8 md:w-8 ${
        dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
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
    <div className="border-t border-white/10 p-3">
      <Link
        href="/account"
        className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.06]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-semibold text-teal-200 ring-1 ring-teal-400/30">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{name}</p>
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
          {logo(false)}
        </div>
        {bell(false)}
      </header>

      {/* Desktop: fixed sidebar. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar md:flex print:hidden">
        <div className="flex items-center justify-between gap-2.5 border-b border-white/10 px-5 py-5">
          {logo(true)}
          {bell(true)}
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav show={show} team={team} />
        </div>
        {account}
      </aside>
    </>
  );
}
