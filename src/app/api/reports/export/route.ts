import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/access";
import { getReportCases, allBreakdowns } from "@/lib/reporting";
import { buildReportExcelBuffer, buildReportPdfBuffer } from "@/lib/reportExport";
import { isMonthKey, monthLabel, overheadsForMonth } from "@/lib/overheads";

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  await requirePermission("page.reports");

  const format = request.nextUrl.searchParams.get("format");
  // A month report also includes that month's expenses, salaries and net profit.
  const monthParam = request.nextUrl.searchParams.get("month") ?? undefined;
  const month = isMonthKey(monthParam) ? monthParam : undefined;
  const cases = await getReportCases(month);
  const breakdowns = allBreakdowns(cases);
  const period = month
    ? { label: monthLabel(month), overheads: await overheadsForMonth(month) }
    : { label: "All time", overheads: null };
  const fileTag = month ?? dateStamp();

  if (format === "xlsx") {
    const buffer = await buildReportExcelBuffer(cases, breakdowns, period);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${fileTag}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await buildReportPdfBuffer(cases, breakdowns, period);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${fileTag}.pdf"`,
      },
    });
  }

  return new Response("Unknown format. Use ?format=xlsx or ?format=pdf.", { status: 400 });
}
