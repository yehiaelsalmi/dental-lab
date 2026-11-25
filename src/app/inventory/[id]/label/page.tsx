import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { PrintButton } from "@/components/PrintButton";
import { LabelNudge } from "@/components/LabelNudge";

// 38 x 25 mm stickers (wide x tall): one per block (?blocks=id,id or ?blocks=open), or the
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
        where:
          blocksParam === "open"
            ? { itemId: id, finishedAt: null }
            : { itemId: id, id: { in: blocksParam.split(",") } },
        orderBy: { code: "asc" },
      })
    : [];
  const labels = blocks.length
    ? blocks.map((b) => ({
        key: b.id,
        code: b.code,
        name: b.name?.trim() || null,
      }))
    : [{ key: item.id, code: item.code, name: null }];
  // Vector QR: thermal label printers (203 dpi) print it with sharp edges,
  // where a scaled picture came out grey and fuzzy and wouldn't scan.
  const qrs = await Promise.all(
    labels.map((l) =>
      QRCode.toString(l.code, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      }),
    ),
  );

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 print:p-0">
      <style>{`@page { size: 38mm 25mm; margin: 0; } @media print { html, body { background: #fff; } .sticker { break-after: page; } } .qr svg { display: block; width: 100%; height: 100%; shape-rendering: crispEdges; } .sticker { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
      <div
        className="mx-auto mb-4 flex items-center justify-between gap-4 print:hidden"
        style={{ width: "60mm" }}
      >
        <Link
          href={`/inventory/${item.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={15} />
          Back
        </Link>
        <PrintButton />
      </div>
      <p className="mb-3 text-center text-xs text-slate-500 print:hidden">
        {labels.length} label{labels.length === 1 ? "" : "s"} · 38 x 25 mm
      </p>
      <details className="mx-auto mb-4 max-w-md rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 print:hidden">
        <summary className="cursor-pointer font-medium text-slate-800">
          Label printer settings
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>
            Once: Windows Settings → Printers → the Xprinter → Printing
            preferences → Page setup → New, width 38 mm, height 25 mm, and make
            it the default paper. (If the printer keeps its wider default paper,
            the print lands to one side of the sticker.)
          </li>
          <li>
            In the print window pick the label printer (e.g. Xprinter), not
            &quot;Save as PDF&quot;.
          </li>
          <li>
            More settings: Paper size 38 x 25 mm, Margins: None, Scale: Default
            (100%), turn off Headers and footers.
          </li>
          <li>
            In Printing preferences set Darkness / Density higher (e.g. 10-12)
            and Speed lower if the print is faint.
          </li>
          <li>
            If the print starts in the wrong place or runs over the gap:
            calibrate the printer (hold the feed button until it feeds a few
            labels).
          </li>
        </ol>
      </details>
      <LabelNudge />
      <div className="flex flex-col items-center gap-3 print:gap-0">
        {labels.map((l, i) => (
          <div
            key={l.key}
            className="sticker overflow-hidden bg-white ring-1 ring-slate-300 print:ring-0"
            style={{
              width: "38mm",
              height: "25mm",
              color: "#000",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            <div
              className="flex h-full w-full items-center gap-[1mm]"
              style={{
                padding: "2mm",
                transform:
                  "translate(var(--label-dx, 0mm), var(--label-dy, 0mm))",
              }}
            >
              <div
                className="qr shrink-0"
                style={{ width: "19mm", height: "19mm", padding: "0.5mm" }}
                dangerouslySetInnerHTML={{ __html: qrs[i] }}
              />
              <div
                className="min-w-0 flex-1 overflow-hidden font-semibold"
                style={{ fontSize: "5.5pt", lineHeight: 1.15 }}
              >
                <p
                  className="line-clamp-2 break-words font-bold"
                  style={{ fontSize: "6.5pt" }}
                >
                  {item.name}
                </p>
                {l.name && (
                  <p className="line-clamp-2 break-words font-bold">{l.name}</p>
                )}
                {item.colour && <p className="truncate">{item.colour}</p>}
                {item.size && <p className="truncate">{item.size}</p>}
                {item.scalingFactor && (
                  <p className="truncate">SF {item.scalingFactor}</p>
                )}
                <p className="truncate font-bold">{l.code}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
