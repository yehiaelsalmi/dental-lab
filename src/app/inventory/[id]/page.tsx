import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PackagePlus, Printer, Trash2, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requireAccess } from "@/lib/access";
import { amountText, canSeeInventory, isLow, minText, stockText } from "@/lib/inventory";
import { formatDateTime } from "@/lib/dates";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ScanBox } from "@/components/ScanBox";
import { deleteItem, receiveStock, updateItem } from "../actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const KIND_LABEL: Record<string, string> = {
  RECEIVED: "received",
  USED: "used",
  BLOCK_DONE: "block finished (rest discarded)",
  CORRECTION: "correction",
};

export default async function InventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scanned?: string; created?: string; saved?: string; received?: string; error?: string }>;
}) {
  const access = await requireAccess();
  if (!canSeeInventory(access)) redirect("/cases?error=forbidden");
  const manage = can(access, "page.inventory");
  const { id } = await params;
  const { scanned, created, saved, received, error } = await searchParams;
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { createdBy: { select: { name: true } }, case: { select: { id: true, patientName: true } } },
      },
    },
  });
  if (!item) notFound();
  const low = isLow(item);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/inventory" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} />
        Inventory
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{item.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[
              item.type,
              item.colour,
              item.size,
              item.scalingFactor && `scaling ${item.scalingFactor}`,
              item.unitsPerBlock && `${item.unitsPerBlock} units per block`,
            ]
              .filter(Boolean)
              .join(" · ") ||
              "No details yet"}
          </p>
          <p className="mt-1 flex items-center gap-2 font-mono text-xs text-slate-400">
            {item.code}
            {manage && (
              <Link href={`/inventory/${item.id}/label`} className="inline-flex items-center gap-1 font-sans font-medium text-brand hover:text-brand-hover">
                <Printer size={12} /> Print QR label
              </Link>
            )}
          </p>
        </div>
        <div className={`rounded-xl px-5 py-3 text-right ${low ? "bg-rose-50 ring-1 ring-rose-200" : "bg-white ring-1 ring-slate-200"}`}>
          <p className={`text-2xl font-semibold ${low ? "text-rose-700" : "text-slate-900"}`}>{stockText(item)}</p>
          <p className="text-xs text-slate-500">
            in stock{item.unitsPerBlock ? ` (${item.quantity} units)` : ""}
            {item.minQuantity != null ? ` · minimum ${minText(item)}` : ""}
          </p>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {scanned && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Scanned: this is the item.</p>}
      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Item added. Print its QR label and stick it on the box.</p>}
      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}
      {received && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Added {received} {item.unitsPerBlock ? "block(s)" : ""} to stock. Now {stockText(item)} in stock.
        </p>
      )}
      {low && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <TriangleAlert size={15} /> Low stock: at or below the minimum.
        </p>
      )}

      {manage && (
        <section className="mb-6 rounded-xl border-2 border-emerald-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <PackagePlus size={16} className="text-emerald-600" />
            Add received stock
          </h2>
          <form action={receiveStock} className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={item.id} />
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              {item.unitsPerBlock ? "Blocks that came in" : "How many came in"}
              <input name="amount" type="number" min={1} step={1} required autoFocus={!!scanned} className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Note (optional)
              <input name="note" maxLength={200} placeholder="e.g. supplier, invoice no." className={INPUT} />
            </label>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Add to stock
            </button>
          </form>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Scan another item</h2>
        <ScanBox grabTyping={false} />
      </section>

      {manage && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
          <form action={updateItem} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={item.id} />
            {(
              [
                ["name", "Name", item.name],
                ["type", "Type", item.type],
                ["colour", "Colour", item.colour],
                ["size", "Size", item.size],
                ["scalingFactor", "Scaling factor", item.scalingFactor],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                {label}
                <input name={name} required={name === "name"} maxLength={name === "scalingFactor" ? 40 : 120} defaultValue={value ?? ""} className={INPUT} />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Units per block (blocks/discs)
              <input name="unitsPerBlock" type="number" min={1} step={1} defaultValue={item.unitsPerBlock ?? ""} placeholder="Empty for pieces" className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Minimum (warn at or below; {item.unitsPerBlock ? "blocks" : "pieces"})
              <input
                name="minQuantity"
                type="number"
                min={0}
                step={1}
                defaultValue={item.minQuantity == null ? "" : item.unitsPerBlock ? Math.round(item.minQuantity / item.unitsPerBlock) : item.minQuantity}
                placeholder="None"
                className={INPUT}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              {item.unitsPerBlock ? "Units left in stock (correct a count)" : "Quantity in stock (correct a count)"}
              <input name="quantity" type="number" min={0} step={1} required defaultValue={item.quantity} className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Reason for a correction (optional)
              <input name="correctionNote" maxLength={200} placeholder="e.g. counted, damaged" className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 sm:col-span-2">
              Notes
              <input name="notes" maxLength={500} defaultValue={item.notes ?? ""} className={INPUT} />
            </label>
            <button type="submit" className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Save
            </button>
          </form>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">History</h2>
        {item.movements.length === 0 ? (
          <p className="text-sm text-slate-400">No stock changes yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {item.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-slate-800">
                    <span className={m.change >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                      {m.change >= 0 ? "+" : ""}
                      {amountText(item, m.change)}
                    </span>{" "}
                    {KIND_LABEL[m.kind] ?? m.kind}
                    {m.case && (
                      <>
                        {" for "}
                        <Link href={`/cases/${m.case.id}`} className="font-medium text-brand hover:text-brand-hover">
                          {m.case.patientName}
                        </Link>
                      </>
                    )}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {m.createdBy?.name ?? "Someone"} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
                <span className="text-xs text-slate-500">then {stockText({ quantity: m.quantityAfter, unitsPerBlock: item.unitsPerBlock })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {manage && (
        <form action={deleteItem}>
          <input type="hidden" name="id" value={item.id} />
          <ConfirmSubmitButton
            message={`Delete "${item.name}" and its history from the inventory?`}
            className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            <Trash2 size={14} />
            Delete item
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
