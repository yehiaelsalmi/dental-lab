import ExcelJS from "exceljs";
import { LAB_NAME } from "@/lib/constants";
import {
  type ReportCase,
  type BreakdownKey,
  type PersonTotal,
  caseUnits,
  caseProfit,
  computeTotals,
  BREAKDOWN_LABELS,
} from "@/lib/reporting";
import {
  PDFDocument,
  drawDocHeader,
  drawPageFooters,
  drawSectionTitle,
  drawStatCards,
  drawTable,
  formatDate,
  formatMoney,
  pdfToBuffer,
  type PdfColumn,
} from "@/lib/pdfTable";

const BRAND_ARGB = "FF4F46E5";
const SOFT_ARGB = "FFEEF2FF";
const MONEY_FORMAT = '#,##0 "EGP"';

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ARGB } };
    cell.alignment = { vertical: "middle" };
  });
}

function styleTotalRow(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT_ARGB } };
  });
}

const EXCEL_COLUMNS: { header: string; width: number; money?: boolean }[] = [
  { header: "Date", width: 13 },
  { header: "Patient", width: 24 },
  { header: "Doctor", width: 24 },
  { header: "Material", width: 28 },
  { header: "Units", width: 8 },
  { header: "Extra fees", width: 12, money: true },
  { header: "Deduction", width: 12, money: true },
  { header: "Price", width: 14, money: true },
  { header: "Ceramist", width: 20 },
  { header: "Ceramist fee", width: 14, money: true },
  { header: "Designer", width: 20 },
  { header: "Designer fee", width: 14, money: true },
  { header: "Ibar", width: 20 },
  { header: "Ibar fee", width: 12, money: true },
  { header: "Metal", width: 18 },
  { header: "Metal cost", width: 13, money: true },
  { header: "Profit", width: 14, money: true },
];

export async function buildReportExcelBuffer(
  cases: ReportCase[],
  breakdowns: Record<BreakdownKey, PersonTotal[]>
): Promise<Buffer> {
  const totals = computeTotals(cases);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = LAB_NAME;

  const sheet = workbook.addWorksheet("Cases", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = EXCEL_COLUMNS.map((c) => ({
    header: c.header,
    width: c.width,
    style: c.money ? { numFmt: MONEY_FORMAT } : {},
  }));
  styleHeaderRow(sheet.getRow(1));

  cases.forEach((c) => {
    sheet.addRow([
      new Date(c.entryDate),
      c.patientName,
      c.doctor.name,
      c.material?.name ?? "",
      caseUnits(c),
      c.extraFee ?? null,
      c.deduction ?? null,
      c.totalPrice ?? null,
      c.ceramist?.name ?? "",
      c.ceramistFee ?? null,
      c.assignedDesigner?.name ?? "",
      c.designerFee ?? null,
      c.ibarDesigner?.name ?? "",
      c.ibarFee ?? null,
      c.metalType?.name ?? "",
      c.metalCost ?? null,
      caseProfit(c),
    ]);
  });
  sheet.getColumn(1).numFmt = "dd mmm yyyy";

  styleTotalRow(
    sheet.addRow([
      "Total",
      "",
      "",
      "",
      cases.reduce((sum, c) => sum + caseUnits(c), 0),
      "",
      "",
      totals.price,
      "",
      totals.ceramist,
      "",
      totals.designer,
      "",
      totals.ibar,
      "",
      totals.metal,
      totals.profit,
    ])
  );
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXCEL_COLUMNS.length } };

  for (const key of Object.keys(breakdowns) as BreakdownKey[]) {
    const personSheet = workbook.addWorksheet(BREAKDOWN_LABELS[key].slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    personSheet.columns = [
      { header: "Name", width: 30 },
      { header: "Cases", width: 10 },
      { header: "Amount", width: 16, style: { numFmt: MONEY_FORMAT } },
    ];
    styleHeaderRow(personSheet.getRow(1));
    breakdowns[key].forEach((p) => personSheet.addRow([p.name, p.count, p.amount]));
    styleTotalRow(
      personSheet.addRow([
        "Total",
        breakdowns[key].reduce((sum, p) => sum + p.count, 0),
        breakdowns[key].reduce((sum, p) => sum + p.amount, 0),
      ])
    );
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const PDF_COLUMNS: PdfColumn[] = [
  { header: "Date", width: 56 },
  { header: "Patient", width: 62 },
  { header: "Doctor", width: 62 },
  { header: "Material", width: 80 },
  { header: "Units", width: 32, align: "right" },
  { header: "Price", width: 60, align: "right" },
  { header: "Ceramist", width: 46 },
  { header: "Fee", width: 50, align: "right" },
  { header: "Designer", width: 60 },
  { header: "Fee", width: 50, align: "right" },
  { header: "Ibar", width: 38 },
  { header: "Fee", width: 48, align: "right" },
  { header: "Metal", width: 42 },
  { header: "Cost", width: 52, align: "right" },
  { header: "Profit", width: 62, align: "right" },
];

function money(value: number | null | undefined) {
  return value == null ? "-" : formatMoney(value);
}

export async function buildReportPdfBuffer(
  cases: ReportCase[],
  breakdowns: Record<BreakdownKey, PersonTotal[]>
): Promise<Buffer> {
  const totals = computeTotals(cases);
  const totalCosts = totals.ceramist + totals.designer + totals.ibar + totals.metal;
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 20, bufferPages: true });

  drawDocHeader(doc, "Case Report", [`Generated ${formatDate(new Date())}`]);
  drawStatCards(doc, [
    { label: "Cases", value: String(cases.length) },
    { label: "Revenue", value: formatMoney(totals.price) },
    { label: "Total costs", value: formatMoney(totalCosts) },
    { label: "Profit", value: formatMoney(totals.profit), highlight: true },
  ]);

  drawTable(
    doc,
    PDF_COLUMNS,
    cases.map((c) => [
      formatDate(new Date(c.entryDate)),
      c.patientName,
      c.doctor.name,
      c.material?.name ?? "-",
      String(caseUnits(c)),
      money(c.totalPrice),
      c.ceramist?.name ?? "-",
      money(c.ceramistFee),
      c.assignedDesigner?.name ?? "-",
      money(c.designerFee),
      c.ibarDesigner?.name ?? "-",
      money(c.ibarFee),
      c.metalType?.name ?? "-",
      money(c.metalCost),
      formatMoney(caseProfit(c)),
    ]),
    {
      fontSize: 7.5,
      footer: [
        "Total",
        "",
        "",
        "",
        String(cases.reduce((sum, c) => sum + caseUnits(c), 0)),
        formatMoney(totals.price),
        "",
        formatMoney(totals.ceramist),
        "",
        formatMoney(totals.designer),
        "",
        formatMoney(totals.ibar),
        "",
        formatMoney(totals.metal),
        formatMoney(totals.profit),
      ],
    }
  );

  const personColumns: PdfColumn[] = [
    { header: "Name", width: 260 },
    { header: "Cases", width: 70, align: "right" },
    { header: "Amount", width: 120, align: "right" },
  ];

  doc.addPage();
  drawDocHeader(doc, "By Person", [`Generated ${formatDate(new Date())}`]);
  for (const key of Object.keys(breakdowns) as BreakdownKey[]) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
    drawSectionTitle(doc, BREAKDOWN_LABELS[key]);
    drawTable(
      doc,
      personColumns,
      breakdowns[key].map((p) => [p.name, String(p.count), formatMoney(p.amount)]),
      {
        fontSize: 9,
        footer: [
          "Total",
          String(breakdowns[key].reduce((sum, p) => sum + p.count, 0)),
          formatMoney(breakdowns[key].reduce((sum, p) => sum + p.amount, 0)),
        ],
      }
    );
    doc.y += 18;
  }

  drawPageFooters(doc, LAB_NAME);
  return pdfToBuffer(doc);
}
