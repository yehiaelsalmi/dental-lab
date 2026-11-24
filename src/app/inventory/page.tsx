import Link from "next/link";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { ScanBox } from "@/components/ScanBox";
import { createItem } from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const isLow = (i: { quantity: number; minQuantity: number | null }) => i.minQuantity != null && i.quantity <= i.minQuantity;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string; error?: string; deleted?: string }>;
}) {
  await requirePermission("page.inventory");
  const { scan: scanParam, error, deleted } = await searchParams;
  const scan = (scanParam ?? "").trim();

  // A scanned code opens its item straight away.
  if (scan) {
    const byCode = await prisma.inventoryItem.findUnique({ where: { code: scan } });
    if (byCode) redirect(`/inventory/${byCode.id}?scanned=1`);
  }

  const all = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
  const needle = scan.toLowerCase();
  const matches = needle
    ? all.filter((i) =>
        [i.name, i.type, i.colour, i.size, i.code].some((v) => v?.toLowerCase().includes(needle))
      )
    : all;
  const items = [...matches.filter(isLow), ...matches.filter((i) => !isLow(i))];
  const lowCount = all.filter(isLow).length;
  const types = [...new Set(all.map((i) => i.type).filter(Boolean))] as string[];
  // Nothing matched what was scanned: offer to add it with that code.
  const unknownCode = scan && matches.length === 0 ? scan : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Inventory</h1>
      <p className="mb-6 text-sm text-slate-500">
        Materials in stock. Scan an item&apos;s barcode/QR to open it and add received stock.
      </p>

      <div className="mb-6">
        <ScanBox defaultValue={scan} />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {deleted && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Item deleted.</p>}
      {unknownCode && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No item has the code <strong>{unknownCode}</strong>. Add it below; the code is already filled in.
        </p>
      )}
      {lowCount > 0 && !scan && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <TriangleAlert size={15} /> {lowCount} item{lowCount === 1 ? " is" : "s are"} at or below the minimum (shown first, in red).
        </p>
      )}

      <section className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Colour</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
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
                  <td className={`px-4 py-2.5 text-right font-semibold ${low ? "text-rose-700" : "text-slate-900"}`}>{i.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{i.minQuantity ?? "-"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{i.code ?? "-"}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {scan ? "Nothing matches." : "No items yet. Add the first one below."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Add an item</h2>
        <p className="mb-4 text-xs text-slate-500">
          To fill in the code, click the Code box and scan the box&apos;s barcode/QR.
        </p>
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
            <input name="size" maxLength={120} placeholder="e.g. 98 x 14 mm" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Quantity in stock
            <input name="quantity" type="number" min={0} step={1} defaultValue={0} required className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Minimum (warn at or below)
            <input name="minQuantity" type="number" min={0} step={1} placeholder="Optional" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 lg:col-span-2">
            Code (scan the box)
            <input name="code" defaultValue={unknownCode ?? ""} maxLength={200} autoComplete="off" className={`${INPUT} font-mono`} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 sm:col-span-2 lg:col-span-3">
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
    </div>
  );
}
