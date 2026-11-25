"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Cloud,
  Tag,
  FileSpreadsheet,
  Receipt,
  ShieldCheck,
  Wallet,
  Stethoscope,
  ListChecks,
  Banknote,
  UsersRound,
  ChevronDown,
  Settings2,
  TextCursorInput,
  ClipboardCheck,
  HandCoins,
  Boxes,
  SlidersHorizontal,
} from "lucide-react";

// `show` and `team` are decided on the server from the user's permissions.
// Links are grouped: day-to-day work, money, and settings (folded away).
const LINKS = [
  { href: "/cases", label: "Cases", icon: LayoutGrid, group: "work" },
  { href: "TEAM", label: "Team", icon: UsersRound, group: "work" },
  { href: "/inventory", label: "Inventory", icon: Boxes, group: "work" },
  { href: "/doctors", label: "Doctors", icon: Stethoscope, group: "work" },
  { href: "/earnings", label: "My earnings", icon: Wallet, group: "money" },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet, group: "money" },
  { href: "/invoices", label: "Invoices", icon: Receipt, group: "money" },
  { href: "/payments", label: "Payments", icon: HandCoins, group: "money" },
  { href: "/expenses", label: "Expenses", icon: Banknote, group: "money" },
  { href: "/users", label: "Users", icon: Users, group: "settings" },
  { href: "/settings/roles", label: "Roles", icon: ShieldCheck, group: "settings" },
  { href: "/settings/statuses", label: "Statuses", icon: ListChecks, group: "settings" },
  { href: "/settings/checklists", label: "Checklists", icon: ClipboardCheck, group: "settings" },
  { href: "/settings/fields", label: "Custom fields", icon: TextCursorInput, group: "settings" },
  { href: "/settings/pricing", label: "Pricing", icon: Tag, group: "settings" },
  { href: "/settings/google", label: "Drive Settings", icon: Cloud, group: "settings" },
  { href: "/settings/lab", label: "Lab settings", icon: Settings2, group: "settings" },
] as const;

const GROUPS = [
  { key: "work", label: "Work" },
  { key: "money", label: "Money" },
  { key: "settings", label: "Settings" },
] as const;

export type NavHref = Exclude<(typeof LINKS)[number]["href"], "TEAM">;
export type TeamLink = { href: string; label: string };

const ITEM = "group/item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
const IDLE = "text-slate-300 hover:bg-white/[0.06] hover:text-white";
const ACTIVE = "bg-white/10 text-white shadow-[inset_3px_0_0_0_#2dd4bf]";
const ICON_IDLE = "text-slate-400 group-hover/item:text-slate-200";
const ICON_ACTIVE = "text-teal-300";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ show, team }: { show: NavHref[]; team: TeamLink[] }) {
  const pathname = usePathname();
  const inTeam = team.some((t) => isActive(pathname, t.href));
  // Open while on one of its pages; otherwise remembered only for this visit.
  const [teamOpen, setTeamOpen] = useState(inTeam);
  const teamShown = teamOpen || inTeam;
  const inSettings = LINKS.some((l) => l.group === "settings" && isActive(pathname, l.href));
  const [settingsOpen, setSettingsOpen] = useState(inSettings);
  const settingsShown = settingsOpen || inSettings;

  const visible = (l: (typeof LINKS)[number]) => (l.href === "TEAM" ? team.length > 0 : show.includes(l.href));

  return (
    <nav className="flex flex-col gap-5 px-3">
      {GROUPS.map((g) => {
        const links = LINKS.filter((l) => l.group === g.key && visible(l));
        if (links.length === 0) return null;
        const folding = g.key === "settings";
        const open = !folding || settingsShown;
        return (
          <div key={g.key}>
            {folding ? (
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsShown)}
                aria-expanded={settingsShown}
                className="mb-1 flex w-full items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
              >
                <SlidersHorizontal size={12} />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown size={13} className={`transition-transform ${settingsShown ? "rotate-180" : ""}`} />
              </button>
            ) : (
              <p className="mb-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
            )}
            {open && (
              <div className="flex flex-col gap-0.5">
                {links.map((link) => {
                  const Icon = link.icon;
                  if (link.href === "TEAM") {
                    return (
                      <div key="team">
                        <button
                          type="button"
                          onClick={() => setTeamOpen(!teamShown)}
                          aria-expanded={teamShown}
                          className={`${ITEM} w-full ${inTeam ? "text-white" : IDLE}`}
                        >
                          <Icon size={18} strokeWidth={2} className={inTeam ? ICON_ACTIVE : ICON_IDLE} />
                          <span className="flex-1 text-left">Team</span>
                          <ChevronDown size={15} className={`text-slate-500 transition-transform ${teamShown ? "rotate-180" : ""}`} />
                        </button>
                        {teamShown && (
                          <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                            {team.map((t) => (
                              <Link
                                key={t.href}
                                href={t.href}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                  isActive(pathname, t.href) ? "bg-white/10 text-white" : IDLE
                                }`}
                              >
                                {t.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  const active = isActive(pathname, link.href);
                  return (
                    <Link key={link.href} href={link.href} className={`${ITEM} ${active ? ACTIVE : IDLE}`}>
                      <Icon size={18} strokeWidth={2} className={active ? ICON_ACTIVE : ICON_IDLE} />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
