import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { LAB_NAME } from "@/lib/constants";
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
  { header: "#", width: 28 },
  { header: "Date", width: 72 },
  { header: "Patient", width: 137 },
  { header: "Material", width: 140 },
  { header: "Units", width: 42, align: "right" },
  { header: "Amount", width: 80, align: "right" },
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
      lines: { include: { case: { include: { material: true } } } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const lines = [...invoice.lines].sort(
    (a, b) => (a.case?.entryDate.getTime() ?? 0) - (b.case?.entryDate.getTime() ?? 0)
  );
  const period = invoice.periodStart.toISOString().slice(0, 7);
  const invoiceNumber = `INV-${period.replace("-", "")}-${invoice.id.slice(-5).toUpperCase()}`;
  const totalUnits = lines.reduce((sum, l) => sum + l.units, 0);

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  drawDocHeader(doc, "INVOICE", [invoiceNumber, `Issued ${formatDate(invoice.createdAt)}`]);

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
      line.case?.material?.name ?? "-",
      String(line.units),
      formatMoney(line.amount),
    ]),
    { fontSize: 9, footer: ["", "", "Total", "", String(totalUnits), formatMoney(invoice.totalAmount)] }
  );

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
  doc.text("Thank you for working with us.", left, boxTop + 26, { lineBreak: false });

  drawPageFooters(doc, `${LAB_NAME} - ${invoiceNumber}`);
  const buffer = await pdfToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceNumber}-${invoice.doctor.name.replace(/[^\w-]+/g, "-")}.pdf"`,
    },
  });
}
