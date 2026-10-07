"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Cloud,
  Tag,
  FileSpreadsheet,
  Receipt,
  PenTool,
  Brush,
  ShieldCheck,
  Wallet,
  Stethoscope,
  ListChecks,
  Banknote,
} from "lucide-react";

// `show` is decided on the server from the user's role permissions.
const LINKS = [
  { href: "/cases", label: "Cases", icon: LayoutGrid },
  { href: "/earnings", label: "My earnings", icon: Wallet },
  { href: "/designers", label: "Designers", icon: PenTool },
  { href: "/ceramists", label: "Ceramists", icon: Brush },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Banknote },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings/roles", label: "Roles", icon: ShieldCheck },
  { href: "/settings/statuses", label: "Statuses", icon: ListChecks },
  { href: "/settings/pricing", label: "Pricing", icon: Tag },
  { href: "/settings/google", label: "Drive Settings", icon: Cloud },
] as const;

export type NavHref = (typeof LINKS)[number]["href"];

export function SidebarNav({ show }: { show: NavHref[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.filter((l) => show.includes(l.href)).map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-soft text-brand"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
