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
} from "lucide-react";

// `show` and `team` are decided on the server from the user's permissions.
const LINKS = [
  { href: "/cases", label: "Cases", icon: LayoutGrid },
  { href: "/earnings", label: "My earnings", icon: Wallet },
  { href: "TEAM", label: "Team", icon: UsersRound },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Banknote },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings/roles", label: "Roles", icon: ShieldCheck },
  { href: "/settings/statuses", label: "Statuses", icon: ListChecks },
  { href: "/settings/checklists", label: "Checklists", icon: ClipboardCheck },
  { href: "/settings/fields", label: "Custom fields", icon: TextCursorInput },
  { href: "/settings/pricing", label: "Pricing", icon: Tag },
  { href: "/settings/google", label: "Drive Settings", icon: Cloud },
  { href: "/settings/lab", label: "Lab settings", icon: Settings2 },
] as const;

export type NavHref = Exclude<(typeof LINKS)[number]["href"], "TEAM">;
export type TeamLink = { href: string; label: string };

const ITEM = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
const IDLE = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
const ACTIVE = "bg-brand-soft text-brand";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ show, team }: { show: NavHref[]; team: TeamLink[] }) {
  const pathname = usePathname();
  const inTeam = team.some((t) => isActive(pathname, t.href));
  // Open while on one of its pages; otherwise remembered only for this visit.
  const [teamOpen, setTeamOpen] = useState(inTeam);
  const open = teamOpen || inTeam;

  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.map((link) => {
        const Icon = link.icon;
        if (link.href === "TEAM") {
          if (team.length === 0) return null;
          return (
            <div key="team">
              <button
                type="button"
                onClick={() => setTeamOpen(!open)}
                aria-expanded={open}
                className={`${ITEM} w-full ${inTeam ? "text-brand" : IDLE}`}
              >
                <Icon size={18} strokeWidth={2} />
                <span className="flex-1 text-left">Team</span>
                <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="mt-1 flex flex-col gap-0.5 border-l border-slate-200 pl-3 ml-5">
                  {team.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive(pathname, t.href) ? ACTIVE : IDLE
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
        if (!show.includes(link.href)) return null;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${ITEM} ${isActive(pathname, link.href) ? ACTIVE : IDLE}`}
          >
            <Icon size={18} strokeWidth={2} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
