import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getLabSettings, pdfLab } from "@/lib/labSettings";
import {
  PDFDocument,
  PDF_COLORS,
  drawDocHeader,
  drawPageFooters,
  drawTable,
  formatDate,
  formatMoney,
  pdfToBuffer,
  type PdfColumn,
} from "@/lib/pdfTable";

// 1. The units: every material line of every case, at its unit price.
const UNIT_COLUMNS: PdfColumn[] = [
  { header: "#", width: 18 },
  { header: "Date", width: 56 },
  { header: "Patient", width: 94 },
  { header: "Material", width: 148 },
  { header: "Arch", width: 36 },
  { header: "Units", width: 32, align: "right" },
  { header: "Price / unit", width: 55, align: "right" },
  { header: "Subtotal", width: 60, align: "right" },
];

// 2. Extra fees and deductions, one row each.
const ADJUSTMENT_COLUMNS: PdfColumn[] = [
  { header: "Patient", width: 140 },
  { header: "Reason", width: 239 },
  { header: "Type", width: 60 },
  { header: "Amount", width: 60, align: "right" },
];

type BreakdownRow = { material: string; arch: string; units: number; pricePerUnit: number | null };
type AdjustmentRow = { kind: string; amount: number; reason: string };

type LineWithCase = {
  breakdown: string | null;
  adjustments: string | null;
  case: {
    materials: { arch: string; units: number; pricePerUnit: number | null; material: { name: string; pricePerUnit: number } }[];
    adjustments: AdjustmentRow[];
  } | null;
};

// The unit prices as invoiced; invoices made before they were stored use the
// case's saved lines.
function breakdownOf(line: LineWithCase): BreakdownRow[] {
  if (line.breakdown) {
    try {
      return JSON.parse(line.breakdown) as BreakdownRow[];
    } catch {
      // fall through
    }
  }
  return (line.case?.materials ?? []).map((m) => ({
    material: m.material.name,
    arch: m.arch,
    units: m.units,
    pricePerUnit: m.pricePerUnit ?? m.material.pricePerUnit,
  }));
}

// Extra fees / deductions as invoiced (JSON), from older invoices' text
// ("+500 Rush; −300 Remake"), or from the case itself.
function adjustmentsOf(line: LineWithCase): AdjustmentRow[] {
  const text = line.adjustments;
  if (text) {
    if (text.startsWith("[")) {
      try {
        return JSON.parse(text) as AdjustmentRow[];
      } catch {
        // fall through
      }
    }
    return text.split("; ").flatMap((part) => {
      const m = part.match(/^([+−-])([\d,.]+)\s+(.*)$/);
      return m ? [{ kind: m[1] === "+" ? "FEE" : "DEDUCTION", amount: Number(m[2].replace(/,/g, "")), reason: m[3] }] : [];
    });
  }
  return line.case?.adjustments ?? [];
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "long", timeZone: "UTC" });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("page.invoices");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      doctor: true,
      lines: {
        include: {
          case: {
            include: {
              materials: { orderBy: { createdAt: "asc" }, include: { material: true } },
              adjustments: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const lines = [...invoice.lines].sort(
    (a, b) => (a.case?.entryDate.getTime() ?? 0) - (b.case?.entryDate.getTime() ?? 0)
  );
  const period = invoice.periodStart.toISOString().slice(0, 7);
  const invoiceNumber = `INV-${period.replace("-", "")}-${invoice.id.slice(-5).toUpperCase()}`;
  const totalUnits = lines.reduce((sum, l) => sum + l.units, 0);
  const totalExtras = lines.reduce((sum, l) => sum + (l.extraFee ?? 0), 0);
  const totalDeductions = lines.reduce((sum, l) => sum + (l.deduction ?? 0), 0);
  // The price for the units alone (each amount without its extras).
  const unitsSubtotal = invoice.totalAmount - totalExtras + totalDeductions;

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const settings = await getLabSettings();
  drawDocHeader(doc, pdfLab(settings), "INVOICE", [invoiceNumber, `Issued ${formatDate(invoice.createdAt)}`]);

  // The lab's own contact details (Lab Settings), when filled in.
  const contact = [settings.invoiceAddress, settings.invoicePhone].filter(Boolean).join("\n");
  if (contact) {
    doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted);
    doc.text(contact, left, doc.y - 6, { width: pageWidth / 2 });
    doc.y += 10;
  }

  // Billed-to and period, side by side.
  const infoTop = doc.y;
  doc.roundedRect(left, infoTop, pageWidth, 58, 6).fill(PDF_COLORS.stripe);
  doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted);
  doc.text("BILLED TO", left + 14, infoTop + 12, { lineBreak: false });
  doc.text("PERIOD", left + pageWidth / 2, infoTop + 12, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(13).fillColor(PDF_COLORS.text);
  doc.text(invoice.doctor.name, left + 14, infoTop + 27, {
    width: pageWidth / 2 - 28,
    lineBreak: false,
    ellipsis: true,
  });
  doc.text(monthLabel(invoice.periodStart), left + pageWidth / 2, infoTop + 27, { lineBreak: false });
  doc.y = infoTop + 58 + 18;

  const sectionTitle = (title: string) => {
    if (doc.y + 70 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_COLORS.text);
    doc.text(title, left, doc.y);
    doc.y += 5;
  };

  // 1. Units at their price.
  sectionTitle("UNITS");
  const unitRows = lines.flatMap((line, i) => {
    const first = [String(i + 1), line.case ? formatDate(line.case.entryDate) : "-", line.patientName];
    const blank = ["", "", ""];
    const parts = breakdownOf(line);
    if (parts.length === 0) {
      const base = line.amount - (line.extraFee ?? 0) + (line.deduction ?? 0);
      return [[...first, "-", "-", String(line.units), "-", formatMoney(base)]];
    }
    return parts.map((b, j) => [
      ...(j === 0 ? first : blank),
      b.material,
      b.arch === "UPPER" ? "Upper" : "Lower",
      String(b.units),
      b.pricePerUnit == null ? "-" : formatMoney(b.pricePerUnit),
      b.pricePerUnit == null ? "-" : formatMoney(b.pricePerUnit * b.units),
    ]);
  });
  drawTable(doc, UNIT_COLUMNS, unitRows, {
    fontSize: 8.5,
    footer: ["", "", "Units subtotal", "", "", String(totalUnits), "", formatMoney(unitsSubtotal)],
  });

  // 2. Extra fees and deductions.
  const adjustmentRows = lines.flatMap((line) =>
    adjustmentsOf(line).map((a, j) => [
      j === 0 ? line.patientName : "",
      a.reason,
      a.kind === "DEDUCTION" ? "Deduction" : "Extra fee",
      `${a.kind === "DEDUCTION" ? "-" : "+"}${formatMoney(a.amount)}`,
    ])
  );
  if (adjustmentRows.length > 0) {
    doc.y += 16;
    sectionTitle("EXTRA FEES AND DEDUCTIONS");
    const net = totalExtras - totalDeductions;
    drawTable(doc, ADJUSTMENT_COLUMNS, adjustmentRows, {
      fontSize: 8.5,
      footer: ["", "Total", "", `${net < 0 ? "-" : "+"}${formatMoney(Math.abs(net))}`],
    });
  }

  // 3. Summary: units subtotal, extras, deductions, total due.
  const summary: [string, string][] = [["Units subtotal", formatMoney(unitsSubtotal)]];
  if (totalExtras) summary.push(["Extra fees", `+${formatMoney(totalExtras)}`]);
  if (totalDeductions) summary.push(["Deductions", `-${formatMoney(totalDeductions)}`]);
  const boxWidth = 230;
  const rowH = 16;
  const boxHeight = summary.length * rowH + 52;
  if (doc.y + boxHeight + 50 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
  const boxTop = doc.y + 20;
  const boxLeft = left + pageWidth - boxWidth;
  doc.roundedRect(boxLeft, boxTop, boxWidth, boxHeight, 6).fill(PDF_COLORS.stripe);
  summary.forEach(([label, value], i) => {
    const y = boxTop + 12 + i * rowH;
    doc.font("Helvetica").fontSize(9.5).fillColor(PDF_COLORS.muted);
    doc.text(label, boxLeft + 14, y, { lineBreak: false });
    doc.font("Helvetica-Bold").fillColor(PDF_COLORS.text);
    doc.text(value, boxLeft + 14, y, { width: boxWidth - 28, align: "right", lineBreak: false });
  });
  const dueTop = boxTop + 12 + summary.length * rowH + 2;
  doc.roundedRect(boxLeft, dueTop, boxWidth, boxTop + boxHeight - dueTop, 6).fill(PDF_COLORS.brand);
  doc.font("Helvetica").fontSize(9).fillColor("#ffffff");
  doc.text("TOTAL DUE", boxLeft + 14, dueTop + 12, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(15);
  doc.text(formatMoney(invoice.totalAmount), boxLeft + 14, dueTop + 9, {
    width: boxWidth - 28,
    align: "right",
    lineBreak: false,
  });

  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted);
  doc.text(
    `${lines.length} case${lines.length === 1 ? "" : "s"}, ${totalUnits} unit${totalUnits === 1 ? "" : "s"}.`,
    left,
    boxTop + 12,
    { lineBreak: false }
  );
  doc.y = boxTop + boxHeight + 22;

  if (settings.invoicePayment) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_COLORS.text);
    doc.text("PAYMENT DETAILS", left, doc.y);
    doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted);
    doc.text(settings.invoicePayment, left, doc.y + 4, { width: pageWidth });
    doc.y += 12;
  }
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted);
  doc.text(settings.invoiceFooter || "Thank you for working with us.", left, doc.y, { width: pageWidth });

  drawPageFooters(doc, `${settings.name} - ${invoiceNumber}`);
  const buffer = await pdfToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceNumber}-${invoice.doctor.name.replace(/[^\w-]+/g, "-")}.pdf"`,
    },
  });
}
