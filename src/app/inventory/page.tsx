import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requireAccess } from "@/lib/access";
import { canSeeInventory, isLow, normalizeCode, stockText } from "@/lib/inventory";
import { ScanBox } from "@/components/ScanBox";
import { createItem } from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string; error?: string; deleted?: string }>;
}) {
  const access = await requireAccess();
  if (!canSeeInventory(access)) redirect("/cases?error=forbidden");
  const manage = can(access, "page.inventory");
  const { scan: scanParam, error, deleted } = await searchParams;
  const scan = (scanParam ?? "").trim();

  // A scanned QR label (item or block) opens its item straight away.
  if (scan) {
    const code = normalizeCode(scan);
    const block = code.startsWith("BLK") ? await prisma.inventoryBlock.findUnique({ where: { code } }) : null;
    if (block) redirect(`/inventory/${block.itemId}?scanned=1&block=${block.id}`);
    const byCode = await prisma.inventoryItem.findUnique({ where: { code } });
    if (byCode) redirect(`/inventory/${byCode.id}?scanned=1`);
  }

  const all = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
  const needle = scan.toLowerCase();
  const matches = needle
    ? all.filter((i) => [i.name, i.type, i.colour, i.size, i.code].some((v) => v?.toLowerCase().includes(needle)))
    : all;
  const items = [...matches.filter(isLow), ...matches.filter((i) => !isLow(i))];
  const lowCount = all.filter(isLow).length;
  const types = [...new Set(all.map((i) => i.type).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Inventory</h1>
      <p className="mb-6 text-sm text-slate-500">
        Materials in stock. Every block / disc has its own QR label (other items have one per item): scan it to open it.
      </p>

      <div className="mb-6">
        <ScanBox defaultValue={scan} />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {deleted && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Item deleted.</p>}
      {lowCount > 0 && !scan && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <TriangleAlert size={15} /> {lowCount} item{lowCount === 1 ? " is" : "s are"} at or below the minimum (shown first, in red).
        </p>
      )}

      <section className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Colour</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Scaling factor</th>
              <th className="px-4 py-3 text-right font-medium">In stock</th>
              <th className="px-4 py-3 text-right font-medium">Minimum</th>
              <th className="px-4 py-3 font-medium">Code</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => {
              const low = isLow(i);
              return (
                <tr key={i.id} className={low ? "bg-rose-50 hover:bg-rose-100" : "hover:bg-slate-50"}>
                  <td className="px-4 py-2.5">
                    <Link href={`/inventory/${i.id}`} className="font-medium text-slate-900 hover:text-brand">
                      {i.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{i.type ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{i.colour ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{i.size ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{i.scalingFactor ?? "-"}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${low ? "text-rose-700" : "text-slate-900"}`}>
                    {stockText(i)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{i.minQuantity ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-slate-500">{i.code ?? "-"}</span>
                    {manage && (
                      <Link href={`/inventory/${i.id}/label`} className="ml-2 inline-flex items-center text-slate-400 hover:text-brand" aria-label="Print QR label">
                        <Printer size={13} />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  {scan ? "Nothing matches." : manage ? "No items yet. Add the first one below." : "No items yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {manage && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Add an item</h2>
          <p className="mb-4 text-xs text-slate-500">The system gives it a code and a QR label you can print.</p>
          <form action={createItem} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Name
              <input name="name" required maxLength={120} className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Type
              <input name="type" list="inventory-types" maxLength={120} placeholder="e.g. Zirconia disc" className={INPUT} />
              <datalist id="inventory-types">
                {types.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Colour
              <input name="colour" maxLength={120} placeholder="e.g. A2" className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Size
              <input name="size" maxLength={120} placeholder="e.g. 98.5 x 18" className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Scaling factor
              <input name="scalingFactor" maxLength={40} placeholder="e.g. 1.234" className={INPUT} />
            </label>
            <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">
              <input type="checkbox" name="trackBlocks" defaultChecked className="h-4 w-4 accent-brand" />
              Blocks / discs: each one gets its own QR label
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Quantity in stock (blocks / pieces)
              <input name="quantity" type="number" min={0} step={1} defaultValue={0} required className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Minimum (blocks / pieces)
              <input name="minQuantity" type="number" min={0} step={1} placeholder="Optional" className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Notes (optional)
              <input name="notes" maxLength={500} className={INPUT} />
            </label>
            <div className="flex items-end">
              <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
                Add item
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
