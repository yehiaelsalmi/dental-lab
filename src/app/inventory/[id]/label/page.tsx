import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { PrintButton } from "@/components/PrintButton";

// A small sticker for the item's box: its QR code (the item's code, which
// the scanner types into the Inventory scan box) and its details.
export default async function InventoryLabelPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("page.inventory");
  const { id } = await params;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || !item.code) notFound();
  const qr = await QRCode.toDataURL(item.code, { margin: 1, width: 400, errorCorrectionLevel: "M" });

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 print:p-0">
      {/* 60 x 40 mm sticker, no browser margins. */}
      <style>{`@page { size: 60mm 40mm; margin: 0; } @media print { html, body { background: #fff; } }`}</style>
      <div className="mx-auto mb-4 flex items-center justify-between print:hidden" style={{ width: "60mm" }}>
        <Link href={`/inventory/${item.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={15} />
          Back
        </Link>
        <PrintButton />
      </div>
      <div
        className="mx-auto flex items-center gap-2 overflow-hidden bg-white text-slate-900 ring-1 ring-slate-300 print:ring-0"
        style={{ width: "60mm", height: "40mm", padding: "2.5mm" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Item QR code" style={{ width: "30mm", height: "30mm" }} className="shrink-0" />
        <div className="min-w-0" style={{ fontSize: "7pt", lineHeight: 1.25 }}>
          <p className="break-words font-bold" style={{ fontSize: "9pt" }}>
            {item.name}
          </p>
          {item.type && <p>{item.type}</p>}
          {item.colour && <p>Colour: {item.colour}</p>}
          {item.size && <p>Size: {item.size}</p>}
          {item.scalingFactor && <p>Scaling: {item.scalingFactor}</p>}
          {item.unitsPerBlock && <p>{item.unitsPerBlock} units / block</p>}
          <p className="mt-0.5 font-mono" style={{ fontSize: "6.5pt" }}>
            {item.code}
          </p>
        </div>
      </div>
    </div>
  );
}
