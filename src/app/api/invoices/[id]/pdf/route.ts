import { NextResponse } from "next/server";
import { materialSummary } from "@/lib/caseMaterials";
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

const COLUMNS: PdfColumn[] = [
  { header: "#", width: 22 },
  { header: "Date", width: 60 },
  { header: "Patient", width: 104 },
  { header: "Material", width: 104 },
  { header: "Units", width: 34, align: "right" },
  { header: "Extras", width: 56, align: "right" },
  { header: "Deduct.", width: 56, align: "right" },
  { header: "Amount", width: 63, align: "right" },
];

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
      lines: { include: { case: { include: { materials: { orderBy: { createdAt: "asc" }, include: { material: true, metalType: true } } } } } },
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

  drawTable(
    doc,
    COLUMNS,
    lines.map((line, i) => [
      String(i + 1),
      line.case ? formatDate(line.case.entryDate) : "-",
      line.patientName,
      line.case ? materialSummary(line.case.materials) || "-" : "-",
      String(line.units),
      line.extraFee ? formatMoney(line.extraFee) : "-",
      line.deduction ? `-${formatMoney(line.deduction)}` : "-",
      formatMoney(line.amount),
    ]),
    {
      fontSize: 8.5,
      footer: [
        "",
        "",
        "Total",
        "",
        String(totalUnits),
        totalExtras ? formatMoney(totalExtras) : "",
        totalDeductions ? `-${formatMoney(totalDeductions)}` : "",
        formatMoney(invoice.totalAmount),
      ],
    }
  );

  // What each extra fee and deduction was for.
  const explained = lines.filter((l) => l.adjustments);
  if (explained.length > 0) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_COLORS.text);
    doc.text("EXTRA FEES AND DEDUCTIONS", left, doc.y);
    doc.font("Helvetica").fontSize(8.5).fillColor(PDF_COLORS.muted);
    for (const l of explained) {
      doc.text(`${l.patientName}: ${l.adjustments}`, left, doc.y + 3, { width: pageWidth });
    }
  }

  // Amount-due box, right-aligned under the table.
  const boxWidth = 220;
  const boxHeight = 50;
  if (doc.y + boxHeight + 40 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
  const boxTop = doc.y + 18;
  const boxLeft = left + pageWidth - boxWidth;
  doc.roundedRect(boxLeft, boxTop, boxWidth, boxHeight, 6).fill(PDF_COLORS.brand);
  doc.font("Helvetica").fontSize(9).fillColor("#ffffff");
  doc.text("AMOUNT DUE", boxLeft + 14, boxTop + 10, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(17);
  doc.text(formatMoney(invoice.totalAmount), boxLeft + 14, boxTop + 24, {
    width: boxWidth - 28,
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
