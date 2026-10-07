import ExcelJS from "exceljs";
import { LAB_NAME } from "@/lib/constants";
import {
  type ReportCase,
  type BreakdownKey,
  type PersonTotal,
  caseUnits,
  caseProfit,
  caseMaterialsText,
  caseMetalsText,
  staffFees,
  staffText,
  computeTotals,
  designerFees,
  designerNames,
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

import type { Overheads } from "@/lib/overheads";

// What period the report covers; a month report also carries that month's
// expenses and salaries so it can show net profit.
export type ReportPeriod = { label: string; overheads: Overheads | null };

// Case profit minus the month's expenses and salaries, as label/amount rows.
function netProfitRows(caseProfit: number, o: Overheads): [string, number][] {
  return [
    ["Case profit", caseProfit],
    ...o.expenses.map((e): [string, number] => [`Expense: ${e.name}${e.recurring ? " (monthly)" : ""}`, -e.amount]),
    ...o.salaries.map((s): [string, number] => [`Salary: ${s.name}`, -s.amount]),
    ["Net profit", caseProfit - o.expenseTotal - o.salaryTotal],
  ];
}

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
  { header: "Designer before ibar", width: 20 },
  { header: "Fee", width: 12, money: true },
  { header: "Designer", width: 20 },
  { header: "Designer fee", width: 14, money: true },
  { header: "Ibar", width: 20 },
  { header: "Ibar fee", width: 12, money: true },
  { header: "Metal", width: 18 },
  { header: "Metal cost", width: 13, money: true },
  { header: "Milling cost", width: 13, money: true },
  { header: "Photogrammetry cost", width: 20, money: true },
  { header: "Other roles", width: 30 },
  { header: "Other roles fees", width: 16, money: true },
  { header: "Profit", width: 14, money: true },
];

export async function buildReportExcelBuffer(
  cases: ReportCase[],
  breakdowns: Record<BreakdownKey, PersonTotal[]>,
  period: ReportPeriod
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
      caseMaterialsText(c),
      caseUnits(c),
      c.extraFee ?? null,
      c.deduction ?? null,
      c.totalPrice ?? null,
      c.ceramist?.name ?? "",
      c.ceramistFee ?? null,
      c.firstDesigner?.name ?? "",
      c.firstDesignerFee ?? null,
      c.assignedDesigner?.name ?? "",
      c.designerFee ?? null,
      c.ibarDesigner?.name ?? "",
      c.ibarFee ?? null,
      caseMetalsText(c),
      c.metalCost ?? null,
      c.millingCost ?? null,
      c.photogrammetryCost ?? null,
      staffText(c),
      c.assignments.length ? staffFees(c) : null,
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
      cases.reduce((sum, c) => sum + (c.firstDesignerFee ?? 0), 0),
      "",
      cases.reduce((sum, c) => sum + (c.designerFee ?? 0), 0),
      "",
      totals.ibar,
      "",
      totals.metal,
      totals.milling,
      totals.photogrammetry,
      "",
      totals.staff,
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

  if (period.overheads) {
    const net = workbook.addWorksheet("Net profit");
    net.columns = [
      { header: period.label, width: 40 },
      { header: "Amount", width: 18, style: { numFmt: MONEY_FORMAT } },
    ];
    styleHeaderRow(net.getRow(1));
    const rows = netProfitRows(totals.profit, period.overheads);
    rows.forEach(([label, amount], i) => {
      const row = net.addRow([label, amount]);
      if (i === rows.length - 1) styleTotalRow(row);
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const PDF_COLUMNS: PdfColumn[] = [
  { header: "Date", width: 54 },
  { header: "Patient", width: 52 },
  { header: "Doctor", width: 50 },
  { header: "Material", width: 56 },
  { header: "Units", width: 30, align: "right" },
  { header: "Price", width: 56, align: "right" },
  { header: "Ceramist", width: 42 },
  { header: "Fee", width: 48, align: "right" },
  { header: "Designer", width: 50 },
  { header: "Fee", width: 50, align: "right" },
  { header: "Ibar", width: 34 },
  { header: "Fee", width: 46, align: "right" },
  { header: "Metal", width: 38 },
  { header: "Cost", width: 46, align: "right" },
  { header: "Milling", width: 44, align: "right" },
  { header: "Photogr.", width: 44, align: "right" },
  { header: "Profit", width: 56, align: "right" },
];

function money(value: number | null | undefined) {
  return value == null ? "-" : formatMoney(value);
}

export async function buildReportPdfBuffer(
  cases: ReportCase[],
  breakdowns: Record<BreakdownKey, PersonTotal[]>,
  period: ReportPeriod
): Promise<Buffer> {
  const totals = computeTotals(cases);
  const totalCosts =
    totals.ceramist +
    totals.designer +
    totals.ibar +
    totals.metal +
    totals.milling +
    totals.photogrammetry +
    totals.staff;
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 20, bufferPages: true });

  drawDocHeader(doc, "Case Report", [period.label, `Generated ${formatDate(new Date())}`]);
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
      caseMaterialsText(c) || "-",
      String(caseUnits(c)),
      money(c.totalPrice),
      c.ceramist?.name ?? "-",
      money(c.ceramistFee),
      designerNames(c) || "-",
      money(designerFees(c)),
      c.ibarDesigner?.name ?? "-",
      money(c.ibarFee),
      caseMetalsText(c) || "-",
      money(c.metalCost),
      money(c.millingCost),
      money(c.photogrammetryCost),
      formatMoney(caseProfit(c)),
    ]),
    {
      fontSize: 7,
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
        formatMoney(totals.milling),
        formatMoney(totals.photogrammetry),
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

  if (period.overheads) {
    const o = period.overheads;
    doc.addPage();
    drawDocHeader(doc, "Net Profit", [period.label, `Generated ${formatDate(new Date())}`]);
    drawStatCards(doc, [
      { label: "Case profit", value: formatMoney(totals.profit) },
      { label: "Expenses", value: formatMoney(o.expenseTotal) },
      { label: "Salaries", value: formatMoney(o.salaryTotal) },
      {
        label: "Net profit",
        value: formatMoney(totals.profit - o.expenseTotal - o.salaryTotal),
        highlight: true,
      },
    ]);
    const rows = netProfitRows(totals.profit, o);
    drawTable(
      doc,
      [
        { header: "Item", width: 360 },
        { header: "Amount", width: 140, align: "right" },
      ],
      rows.slice(0, -1).map(([label, amount]) => [label, formatMoney(amount)]),
      { fontSize: 9, footer: ["Net profit", formatMoney(rows[rows.length - 1][1])] }
    );
  }

  drawPageFooters(doc, LAB_NAME);
  return pdfToBuffer(doc);
}
