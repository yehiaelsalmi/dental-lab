import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/access";
import { getReportCases, allBreakdowns } from "@/lib/reporting";
import { buildReportExcelBuffer, buildReportPdfBuffer } from "@/lib/reportExport";

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  await requirePermission("page.reports");

  const format = request.nextUrl.searchParams.get("format");
  const cases = await getReportCases();
  const breakdowns = allBreakdowns(cases);

  if (format === "xlsx") {
    const buffer = await buildReportExcelBuffer(cases, breakdowns);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${dateStamp()}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await buildReportPdfBuffer(cases, breakdowns);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${dateStamp()}.pdf"`,
      },
    });
  }

  return new Response("Unknown format. Use ?format=xlsx or ?format=pdf.", { status: 400 });
}
