import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackagePlus, Trash2, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DateField } from "@/components/DateField";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ScanBox } from "@/components/ScanBox";
import { deleteItem, receiveStock, updateItem } from "../actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function InventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    scanned?: string;
    created?: string;
    saved?: string;
    received?: string;
    error?: string;
    lot?: string;
    expires?: string;
    made?: string;
  }>;
}) {
  await requirePermission("page.inventory");
  const { id } = await params;
  const { scanned, created, saved, received, error, lot, expires, made } = await searchParams;
  const latest = await prisma.inventoryMovement.findFirst({
    where: { itemId: id, kind: "RECEIVED", OR: [{ lot: { not: null } }, { expiresAt: { not: null } }] },
    orderBy: { createdAt: "desc" },
  });
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 50, include: { createdBy: { select: { name: true } } } } },
  });
  if (!item) notFound();
  const low = item.minQuantity != null && item.quantity <= item.minQuantity;

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
            {[item.type, item.colour, item.size].filter(Boolean).join(" · ") || "No details yet"}
            {(item.ref ?? item.code) && <span className="ml-2 font-mono text-xs text-slate-400">REF {item.ref ?? item.code}</span>}
          </p>
          {latest && (
            <p className="mt-1 text-xs text-slate-500">
              Last received lot {latest.lot ?? "-"}
              {latest.expiresAt && <> · expires {formatDate(latest.expiresAt)}</>}
            </p>
          )}

        </div>
        <div className={`rounded-xl px-5 py-3 text-right ${low ? "bg-rose-50 ring-1 ring-rose-200" : "bg-white ring-1 ring-slate-200"}`}>
          <p className={`text-3xl font-semibold ${low ? "text-rose-700" : "text-slate-900"}`}>{item.quantity}</p>
          <p className="text-xs text-slate-500">in stock{item.minQuantity != null ? ` · minimum ${item.minQuantity}` : ""}</p>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {scanned && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Scanned: this is the item.</p>}
      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Item added.</p>}
      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}
      {received && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Added {received} to stock. Now {item.quantity} in stock.
        </p>
      )}
      {low && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <TriangleAlert size={15} /> Low stock: at or below the minimum.
        </p>
      )}

      <section className="mb-6 rounded-xl border-2 border-emerald-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <PackagePlus size={16} className="text-emerald-600" />
          Add received stock
        </h2>
        {scanned && (lot || expires) && (
          <p className="mb-3 text-xs text-slate-500">
            From the box: lot <strong>{lot ?? "-"}</strong>
            {expires && <> · expires <strong>{formatDate(expires)}</strong></>}
          </p>
        )}
        <form action={receiveStock} className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_1fr_140px_auto] sm:items-end">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="made" value={made ?? ""} />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            How many came in
            <input name="amount" type="number" min={1} step={1} required autoFocus={!!scanned} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Lot
            <input name="lot" maxLength={80} defaultValue={lot ?? ""} placeholder="From the scan" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Note (optional)
            <input name="note" maxLength={200} placeholder="e.g. supplier, invoice no." className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Expiry
            <DateField name="expires" defaultValue={expires} className={INPUT} />
          </label>
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Add to stock
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Scan another item</h2>
        <ScanBox grabTyping={false} />
      </section>

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
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              {label}
              <input name={name} required={name === "name"} maxLength={120} defaultValue={value ?? ""} className={INPUT} />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Quantity in stock (correct a count)
            <input name="quantity" type="number" min={0} step={1} required defaultValue={item.quantity} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Reason for a correction (optional)
            <input name="correctionNote" maxLength={200} placeholder="e.g. counted, used, damaged" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Minimum (warn at or below)
            <input name="minQuantity" type="number" min={0} step={1} defaultValue={item.minQuantity ?? ""} placeholder="None" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Code (click and scan any box of it)
            <input name="code" maxLength={300} autoComplete="off" defaultValue={item.code ?? ""} className={`${INPUT} font-mono`} />
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
                      {m.change}
                    </span>{" "}
                    {m.kind === "RECEIVED" ? "received" : "correction"}
                    {m.lot ? ` · lot ${m.lot}` : ""}
                    {m.expiresAt ? ` · expires ${formatDate(m.expiresAt)}` : ""}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {m.createdBy?.name ?? "Someone"} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
                <span className="text-xs text-slate-500">then {m.quantityAfter}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </div>
  );
}
