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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/cases/${caseRecord.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={15} />
          Back to case
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-6 text-sm text-slate-800 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <LabMark lab={lab} size={48} />
            <div>
              <p className="text-base font-semibold text-slate-900">{lab.name}</p>
              {(lab.invoicePhone || lab.invoiceAddress) && (
                <p className="text-xs text-slate-500">
                  {[lab.invoicePhone, lab.invoiceAddress].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Case QR code" width={140} height={140} />
            <span className="mt-1 text-[10px] text-slate-400">Scan to open the case</span>
          </div>
        </header>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Case sheet</p>
          <h1 className="text-2xl font-semibold text-slate-900">{caseRecord.patientName}</h1>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 print:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-900">Materials</h2>
        {caseRecord.materials.length === 0 ? (
          <p className="text-slate-400">No materials recorded.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-1.5 font-medium">Arch</th>
                <th className="py-1.5 font-medium">Material</th>
                <th className="py-1.5 font-medium">Metal</th>
                <th className="py-1.5 text-right font-medium">Units</th>
              </tr>
            </thead>
            <tbody>
              {caseRecord.materials.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-1.5">{l.arch === "UPPER" ? "Upper" : "Lower"}</td>
                  <td className="py-1.5">{l.material.name}</td>
                  <td className="py-1.5">{l.metalType?.name ?? "-"}</td>
                  <td className="py-1.5 text-right">{l.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {caseRecord.units.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-900">Unit codes</h2>
            <p className="flex flex-wrap gap-2">
              {caseRecord.units.map((u) => (
                <span key={u.id} className="rounded border border-slate-300 px-2 py-0.5">
                  {u.code}
                </span>
              ))}
            </p>
          </>
        )}

        {caseRecord.fieldValues.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-900">More details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 print:grid-cols-3">
              {caseRecord.fieldValues.map((v) => (
                <div key={v.id} className={v.field.type === "LONGTEXT" ? "col-span-full" : undefined}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{v.field.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{formatFieldValue(v.field.type, v.value)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {caseRecord.notes && (
          <>
            <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-900">Notes</h2>
            <p className="whitespace-pre-wrap">{caseRecord.notes}</p>
          </>
        )}

        <p className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-400">
          Printed {new Date().toLocaleString()} · scan the QR code to open the case
        </p>
      </div>
    </div>
  );
}
