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
import { FitToPage } from "@/components/FitToPage";

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

  // Empty details are left out; the doctor and patient are in the header.
  const shown = details.filter(
    ([label, value]) => label !== "Doctor" && value && value !== "-" && value !== "- / -"
  );
  const lines = caseRecord.materials.map(
    (l) =>
      `${l.arch === "UPPER" ? "Upper" : "Lower"}: ${l.material.name}${l.metalType ? ` (${l.metalType.name})` : ""} × ${l.units}`
  );
  // Text as large as the page allows: smaller only when there's a lot on it.
  const load =
    Math.ceil(shown.length / 2) +
    lines.length +
    caseRecord.fieldValues.length +
    (caseRecord.units.length > 0 ? 2 : 0) +
    Math.ceil((caseRecord.notes?.length ?? 0) / 45) +
    // Long names wrap onto extra lines in the header.
    Math.floor((caseRecord.doctor.name.length + caseRecord.patientName.length) / 30);
  const base = load <= 10 ? 11 : load <= 12 ? 10 : load <= 17 ? 9 : 8;
  // Sizes follow --fit, which FitToPage lowers if the page still overflows.
  const pt = (n: number) => `calc(${n}pt * var(--fit, 1))`;

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

      <FitToPage
        className="mx-auto flex flex-col overflow-hidden bg-white text-slate-900 shadow-md ring-1 ring-slate-300 print:shadow-none print:ring-0"
        style={{ width: "105mm", height: "148mm", padding: "5mm", fontSize: pt(base), lineHeight: 1.3 }}
      >
        <header className="flex items-start justify-between gap-2 border-b-2 border-slate-800 pb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <LabMark lab={lab} size={20} />
              <p className="truncate font-semibold text-slate-700" style={{ fontSize: pt(8.5) }}>
                {lab.name}
              </p>
            </div>
            <h1 className="mt-2 break-words font-extrabold" style={{ fontSize: pt(19), lineHeight: 1.1 }}>
              {caseRecord.doctor.name}
            </h1>
            <p className="mt-1 break-words font-semibold text-slate-700" style={{ fontSize: pt(14), lineHeight: 1.15 }}>
              {caseRecord.patientName}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Case QR code" style={{ width: "30mm", height: "30mm" }} />
            <span className="text-slate-500" style={{ fontSize: pt(6.5) }}>
              Scan to open the case
            </span>
          </div>
        </header>

        {/* The details stretch to fill the page; the rest follows below. */}
        <dl className="mt-3 grid flex-1 grid-cols-2 content-evenly gap-x-3 gap-y-2.5">
          {shown.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="uppercase tracking-wide text-slate-500" style={{ fontSize: pt(base - 3.5) }}>
                {label}
              </dt>
              <dd className="break-words font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        {lines.length > 0 && (
          <Block title="Materials" size={base}>
            {lines.map((line) => (
              <p key={line} className="font-semibold">
                {line}
              </p>
            ))}
          </Block>
        )}

        {caseRecord.units.length > 0 && (
          <Block title="Unit codes" size={base}>
            <p className="flex flex-wrap gap-1">
              {caseRecord.units.map((u) => (
                <span key={u.id} className="rounded border border-slate-400 px-1">
                  {u.code}
                </span>
              ))}
            </p>
          </Block>
        )}

        {caseRecord.fieldValues.length > 0 && (
          <Block title="More details" size={base}>
            {caseRecord.fieldValues.map((v) => (
              <p key={v.id} className="whitespace-pre-wrap break-words">
                <span className="text-slate-500">{v.field.label}:</span> {formatFieldValue(v.field.type, v.value)}
              </p>
            ))}
          </Block>
        )}

        {caseRecord.notes && (
          <Block title="Notes" size={base}>
            <p className="whitespace-pre-wrap break-words">{caseRecord.notes}</p>
          </Block>
        )}

        <p className="mt-3 border-t border-slate-300 pt-1 text-slate-500" style={{ fontSize: pt(6.5) }}>
          Printed {new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo" })}
        </p>
      </FitToPage>
    </div>
  );
}

function Block({ title, size, children }: { title: string; size: number; children: React.ReactNode }) {
  return (
    <section className="mt-3 border-t border-slate-300 pt-1.5">
      <h2 className="mb-0.5 uppercase tracking-wide text-slate-500" style={{ fontSize: `calc(${size - 3.5}pt * var(--fit, 1))` }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
