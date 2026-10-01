"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover print:hidden"
    >
      <Printer size={16} />
      Print
    </button>
  );
}
