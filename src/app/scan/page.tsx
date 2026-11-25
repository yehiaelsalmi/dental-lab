import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { canSeeInventory, normalizeCode } from "@/lib/inventory";

// Where a scan made anywhere in the system lands: works out what the code is
// and opens it.
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const access = await requireAccess();
  const raw = ((await searchParams).code ?? "").trim().slice(0, 300);

  // Inventory labels: INV00001 (item) or BLK000001 (block).
  const code = normalizeCode(raw);
  if (/^(INV|BLK)\d{3,}$/.test(code)) {
    if (!canSeeInventory(access)) redirect("/cases?error=forbidden");
    redirect(`/inventory?scan=${code}`);
  }

  // Case sheet QR: a link ending in /cases/<id>. Scanners set to another
  // keyboard layout garble the symbols and can swap y and z, so try the id
  // as typed and with y/z swapped.
  const swapYZ = (s: string) => s.replace(/[yz]/g, (c) => (c === "y" ? "z" : "y"));
  const tokens = raw.toLowerCase().match(/[a-z0-9]{20,40}/g) ?? [];
  const candidates = [...new Set(tokens.flatMap((t) => [t, swapYZ(t)]))];
  if (candidates.length) {
    const found = await prisma.case.findFirst({ where: { id: { in: candidates } }, select: { id: true } });
    if (found) redirect(`/cases/${found.id}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <ScanLine size={28} className="mx-auto mb-3 text-brand" />
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Didn&apos;t recognise that scan</h1>
        <p className="mb-4 break-all font-mono text-xs text-slate-500">{raw || "(empty)"}</p>
        <p className="mb-4 text-sm text-slate-600">It isn&apos;t a case sheet QR or an inventory label from this system.</p>
        <Link href="/cases" className="text-sm font-medium text-brand hover:text-brand-hover">
          Back to cases
        </Link>
      </div>
    </div>
  );
}
