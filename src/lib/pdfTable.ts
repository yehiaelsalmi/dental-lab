import PDFDocument from "pdfkit";
import { LAB_INITIALS, LAB_NAME } from "@/lib/constants";
import { formatEGP } from "@/lib/money";

export const PDF_COLORS = {
  brand: "#4f46e5",
  brandSoft: "#eef2ff",
  text: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  stripe: "#f8fafc",
};

export type PdfColumn = { header: string; width: number; align?: "left" | "right" };

const CELL_PADDING = 5;

export function formatMoney(value: number) {
  return formatEGP(value);
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Cells never wrap, so a long name is cut with "..." instead of spilling
// into the next row.
function fitText(doc: PDFKit.PDFDocument, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}...`) > width) cut = cut.slice(0, -1);
  return `${cut}...`;
}

export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  rows: string[][],
  options?: { fontSize?: number; footer?: string[] }
) {
  const fontSize = options?.fontSize ?? 8;
  const rowHeight = fontSize + 11;
  const left = doc.page.margins.left;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 18;

  function drawCells(cells: string[], top: number, font: string, color: string) {
    doc.font(font).fontSize(fontSize).fillColor(color);
    let x = left;
    cells.forEach((cell, i) => {
      const inner = columns[i].width - CELL_PADDING * 2;
      doc.text(fitText(doc, cell, inner), x + CELL_PADDING, top + (rowHeight - fontSize) / 2, {
        width: inner,
        align: columns[i].align ?? "left",
        lineBreak: false,
      });
      x += columns[i].width;
    });
  }

  function drawHeader() {
    const top = doc.y;
    doc.rect(left, top, tableWidth, rowHeight).fill(PDF_COLORS.brand);
    drawCells(
      columns.map((c) => c.header),
      top,
      "Helvetica-Bold",
      "#ffffff"
    );
    doc.y = top + rowHeight;
  }

  drawHeader();

  rows.forEach((row, index) => {
    if (doc.y + rowHeight > bottomLimit()) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHeader();
    }
    const top = doc.y;
    if (index % 2 === 1) doc.rect(left, top, tableWidth, rowHeight).fill(PDF_COLORS.stripe);
    drawCells(row, top, "Helvetica", PDF_COLORS.text);
    doc
      .moveTo(left, top + rowHeight)
      .lineTo(left + tableWidth, top + rowHeight)
      .lineWidth(0.5)
      .strokeColor(PDF_COLORS.line)
      .stroke();
    doc.y = top + rowHeight;
  });

  if (rows.length === 0) {
    const top = doc.y;
    doc.font("Helvetica").fontSize(fontSize).fillColor(PDF_COLORS.muted);
    doc.text("Nothing to show.", left + CELL_PADDING, top + (rowHeight - fontSize) / 2, {
      lineBreak: false,
    });
    doc.y = top + rowHeight;
  }

  if (options?.footer) {
    if (doc.y + rowHeight > bottomLimit()) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
    const top = doc.y;
    doc.rect(left, top, tableWidth, rowHeight).fill(PDF_COLORS.brandSoft);
    drawCells(options.footer, top, "Helvetica-Bold", PDF_COLORS.text);
    doc.y = top + rowHeight;
  }

  doc.fillColor(PDF_COLORS.text);
}

// Lab logo block on the left, document title on the right, then a rule.
export function drawDocHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  rightLines: string[] = []
) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.page.margins.top;

  doc.roundedRect(left, top, 34, 34, 6).fill(PDF_COLORS.brand);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#ffffff");
  doc.text(LAB_INITIALS, left, top + 11, { width: 34, align: "center", lineBreak: false });

  doc.font("Helvetica-Bold").fontSize(13).fillColor(PDF_COLORS.text);
  doc.text(LAB_NAME, left + 44, top + 4, { lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted);
  doc.text("Dental laboratory", left + 44, top + 21, { lineBreak: false });

  doc.font("Helvetica-Bold").fontSize(18).fillColor(PDF_COLORS.brand);
  doc.text(title, left, top, { width: right - left, align: "right", lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted);
  rightLines.forEach((line, i) => {
    doc.text(line, left, top + 22 + i * 12, { width: right - left, align: "right", lineBreak: false });
  });

  const ruleY = top + Math.max(44, 26 + rightLines.length * 12);
  doc.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(1).strokeColor(PDF_COLORS.line).stroke();
  doc.y = ruleY + 16;
  doc.fillColor(PDF_COLORS.text);
}

// A row of labelled figures, evenly spread across the page width.
export function drawStatCards(
  doc: PDFKit.PDFDocument,
  cards: { label: string; value: string; highlight?: boolean }[]
) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 10;
  const cardWidth = (width - gap * (cards.length - 1)) / cards.length;
  const top = doc.y;
  const height = 46;

  cards.forEach((card, i) => {
    const x = left + i * (cardWidth + gap);
    doc
      .roundedRect(x, top, cardWidth, height, 6)
      .fill(card.highlight ? PDF_COLORS.brandSoft : PDF_COLORS.stripe);
    doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted);
    doc.text(card.label.toUpperCase(), x + 10, top + 9, { lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(card.highlight ? PDF_COLORS.brand : PDF_COLORS.text);
    doc.text(card.value, x + 10, top + 22, { width: cardWidth - 20, lineBreak: false });
  });

  doc.y = top + height + 16;
  doc.fillColor(PDF_COLORS.text);
}

export function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF_COLORS.text);
  doc.text(title, doc.page.margins.left, doc.y, { lineBreak: false });
  doc.y += 18;
}

// Call once, after all content: needs a document created with bufferPages.
export function drawPageFooters(doc: PDFKit.PDFDocument, leftText: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const y = doc.page.height - doc.page.margins.bottom - 8;
    // Writing this close to the bottom edge would otherwise start a new page.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted);
    doc.text(leftText, left, y, { width, align: "left", lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, left, y, { width, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
}

export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export { PDFDocument };
