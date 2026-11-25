import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { PrintButton } from "@/components/PrintButton";

// 60 x 40 mm stickers: one per block (?blocks=id,id or ?blocks=open), or the
// item's own label. Each QR holds the code the scanner types.
export default async function InventoryLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocks?: string }>;
}) {
  await requirePermission("page.inventory");
  const { id } = await params;
  const { blocks: blocksParam } = await searchParams;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || !item.code) notFound();

  const blocks = blocksParam
    ? await prisma.inventoryBlock.findMany({
        where: blocksParam === "open" ? { itemId: id, finishedAt: null } : { itemId: id, id: { in: blocksParam.split(",") } },
        orderBy: { code: "asc" },
      })
    : [];
  const labels = blocks.length
    ? blocks.map((b) => ({ key: b.id, code: b.code, name: b.name?.trim() || null }))
    : [{ key: item.id, code: item.code, name: null }];
  const qrs = await Promise.all(labels.map((l) => QRCode.toDataURL(l.code, { margin: 1, width: 400, errorCorrectionLevel: "M" })));

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 print:p-0">
      <style>{`@page { size: 60mm 40mm; margin: 0; } @media print { html, body { background: #fff; } .sticker { break-after: page; } }`}</style>
      <div className="mx-auto mb-4 flex items-center justify-between print:hidden" style={{ width: "60mm" }}>
        <Link href={`/inventory/${item.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={15} />
          Back
        </Link>
        <PrintButton />
      </div>
      <p className="mb-3 text-center text-xs text-slate-500 print:hidden">
        {labels.length} label{labels.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-col items-center gap-3 print:gap-0">
        {labels.map((l, i) => (
          <div
            key={l.key}
            className="sticker flex items-center gap-2 overflow-hidden bg-white text-slate-900 ring-1 ring-slate-300 print:ring-0"
            style={{ width: "60mm", height: "40mm", padding: "2.5mm" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrs[i]} alt="QR code" style={{ width: "30mm", height: "30mm" }} className="shrink-0" />
            <div className="min-w-0" style={{ fontSize: "7pt", lineHeight: 1.25 }}>
              <p className="break-words font-bold" style={{ fontSize: "9pt" }}>
                {item.name}
              </p>
              {l.name && (
                <p className="break-words font-semibold" style={{ fontSize: "8pt" }}>
                  {l.name}
                </p>
              )}
              {item.type && <p>{item.type}</p>}
              {item.colour && <p>Colour: {item.colour}</p>}
              {item.size && <p>Size: {item.size}</p>}
              {item.scalingFactor && <p>Scaling: {item.scalingFactor}</p>}
              <p className="mt-0.5 font-mono font-semibold" style={{ fontSize: "7.5pt" }}>
                {l.code}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
