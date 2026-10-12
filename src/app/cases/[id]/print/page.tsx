import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { canViewCase, requireAccess } from "@/lib/access";
import { caseUrl } from "@/lib/email";
import { getLabSettings } from "@/lib/labSettings";
import { formatFieldValue } from "@/lib/customFields";
import { statusLabel } from "@/lib/statuses";
import { LabMark } from "@/components/LabMark";
import { PrintButton } from "@/components/PrintButton";

// A one-page sheet with the case details (no prices) to keep with the work.
export default async function CasePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAccess();

  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: {
      doctor: true,
      createdBy: true,
      assignedDesigner: true,
      firstDesigner: true,
      ceramist: true,
      ibarDesigner: true,
      assignments: { include: { role: true, user: true } },
      fieldValues: { include: { field: true }, orderBy: { field: { position: "asc" } } },
      materials: { orderBy: { createdAt: "asc" }, include: { material: true, metalType: true } },
      units: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!caseRecord || !canViewCase(access, caseRecord)) notFound();

  const [lab, status, qrDataUrl] = await Promise.all([
    getLabSettings(),
    statusLabel(caseRecord.status),
    QRCode.toDataURL(caseUrl(caseRecord.id), { margin: 1, width: 320 }),
  ]);
  const date = (d: Date | null) => (d ? new Date(d).toLocaleDateString() : "-");
  const hasIbar = !!caseRecord.ibarDesignerId;

  const details: [string, string][] = [
    ["Doctor", caseRecord.doctor.name],
    ["Status", status],
    ["Entry date", date(caseRecord.entryDate)],
    ["Due date", date(caseRecord.dueDate)],
    ["Units (upper / lower)", `${caseRecord.unitsUpper ?? "-"} / ${caseRecord.unitsLower ?? "-"}`],
    ["System", caseRecord.system ?? "-"],
    ["Shade", caseRecord.shade ?? "-"],
    ["Ibar designer", caseRecord.ibarDesigner?.name ?? "-"],
    ...(hasIbar ? ([["Designer before ibar", caseRecord.firstDesigner?.name ?? "-"]] as [string, string][]) : []),
    [hasIbar ? "Designer after ibar" : "Designer", caseRecord.assignedDesigner?.name ?? "-"],
    ["Ceramist", caseRecord.ceramist?.name ?? "-"],
    ["Matching", caseRecord.matchingBy ?? "-"],
    ...caseRecord.assignments.map((a) => [a.role.name, a.user.name] as [string, string]),
    [
      "Photogrammetry",
      !caseRecord.needsPhotogrammetry
        ? "Not needed"
        : caseRecord.photogrammetryDoneAt
          ? `Done ${date(caseRecord.photogrammetryDoneAt)}`
          : "Pending",
    ],
    ["Created by", caseRecord.createdBy.name],
  ];

  // Empty details are left out to keep the sheet on one A6 page.
  const shown = details.filter(([, value]) => value && value !== "-" && value !== "- / -");
  const lines = caseRecord.materials.map(
    (l) =>
      `${l.arch === "UPPER" ? "Upper" : "Lower"}: ${l.material.name}${l.metalType ? ` (${l.metalType.name})` : ""} × ${l.units}`
  );

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 print:p-0">
      {/* A6 portrait, no browser margins: the card below is the whole page. */}
      <style>{`@page { size: 105mm 148mm; margin: 0; } @media print { html, body { background: #fff; } }`}</style>
      <div className="mx-auto mb-4 flex items-center justify-between print:hidden" style={{ width: "105mm" }}>
        <Link
          href={`/cases/${caseRecord.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={15} />
          Back to case
        </Link>
        <PrintButton />
      </div>

      <div
        className="mx-auto flex flex-col overflow-hidden bg-white text-slate-800 shadow-md ring-1 ring-slate-300 print:shadow-none print:ring-0"
        style={{ width: "105mm", minHeight: "148mm", padding: "5mm", fontSize: "8pt", lineHeight: 1.3 }}
      >
        <header className="flex items-start justify-between gap-2 border-b border-slate-300 pb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <LabMark lab={lab} size={22} />
              <p className="truncate font-semibold text-slate-900" style={{ fontSize: "8.5pt" }}>
                {lab.name}
              </p>
            </div>
            <p className="mt-2 uppercase tracking-wide text-slate-400" style={{ fontSize: "6.5pt" }}>
              Case sheet
            </p>
            <h1 className="break-words font-bold text-slate-900" style={{ fontSize: "13pt", lineHeight: 1.15 }}>
              {caseRecord.patientName}
            </h1>
            <p className="text-slate-600">{caseRecord.doctor.name}</p>
          </div>
          <div className="flex shrink-0 flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Case QR code" style={{ width: "27mm", height: "27mm" }} />
            <span className="text-slate-400" style={{ fontSize: "6pt" }}>
              Scan to open the case
            </span>
          </div>
        </header>

        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {shown
            .filter(([label]) => label !== "Doctor")
            .map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="uppercase tracking-wide text-slate-400" style={{ fontSize: "6pt" }}>
                  {label}
                </dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
        </dl>

        {lines.length > 0 && (
          <Block title="Materials">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Block>
        )}

        {caseRecord.units.length > 0 && (
          <Block title="Unit codes">
            <p className="flex flex-wrap gap-1">
              {caseRecord.units.map((u) => (
                <span key={u.id} className="rounded border border-slate-300 px-1">
                  {u.code}
                </span>
              ))}
            </p>
          </Block>
        )}

        {caseRecord.fieldValues.length > 0 && (
          <Block title="More details">
            {caseRecord.fieldValues.map((v) => (
              <p key={v.id} className="whitespace-pre-wrap break-words">
                <span className="text-slate-500">{v.field.label}:</span> {formatFieldValue(v.field.type, v.value)}
              </p>
            ))}
          </Block>
        )}

        {caseRecord.notes && (
          <Block title="Notes">
            <p className="whitespace-pre-wrap break-words">{caseRecord.notes}</p>
          </Block>
        )}

        <p className="mt-auto border-t border-slate-200 pt-1 text-slate-400" style={{ fontSize: "6pt" }}>
          Printed {new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo" })}
        </p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-2 border-t border-slate-200 pt-1.5">
      <h2 className="mb-0.5 font-semibold text-slate-900" style={{ fontSize: "7.5pt" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
