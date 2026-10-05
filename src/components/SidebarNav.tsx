"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users, Cloud, Tag, FileSpreadsheet, Receipt, PenTool, Brush } from "lucide-react";
import type { Role } from "@/lib/constants";

const LINKS = [
  { href: "/cases", label: "Cases", icon: LayoutGrid, roles: ["TECHNICIAN", "DESIGNER", "LAB_LEADER", "PHOTOGRAMMETRY"] },
  { href: "/designers", label: "Designers", icon: PenTool, roles: ["LAB_LEADER"] },
  { href: "/ceramists", label: "Ceramists", icon: Brush, roles: ["LAB_LEADER"] },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet, roles: ["LAB_LEADER"] },
  { href: "/invoices", label: "Invoices", icon: Receipt, roles: ["LAB_LEADER"] },
  { href: "/users", label: "Users", icon: Users, roles: ["LAB_LEADER"] },
  { href: "/settings/pricing", label: "Pricing", icon: Tag, roles: ["LAB_LEADER"] },
  { href: "/settings/google", label: "Drive Settings", icon: Cloud, roles: ["LAB_LEADER"] },
] as const;

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.filter((l) => (l.roles as readonly string[]).includes(role)).map((link) => {
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
