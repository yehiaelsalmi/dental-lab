import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { VISIBILITY_INCLUDE, canViewCase, requireAccess } from "@/lib/access";
import { caseUrl } from "@/lib/email";
import { getLabSettings } from "@/lib/labSettings";
import { PrintButton } from "@/components/PrintButton";
import { materialSummary } from "@/lib/caseMaterials";

export default async function CaseLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAccess();

  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: { ...VISIBILITY_INCLUDE, doctor: true, materials: { orderBy: { createdAt: "asc" }, include: { material: true, metalType: true } } },
  });
  if (!caseRecord || !canViewCase(access, caseRecord)) notFound();

  const qrDataUrl = await QRCode.toDataURL(caseUrl(caseRecord.id), { margin: 1, width: 480 });
  const details = [materialSummary(caseRecord.materials), new Date(caseRecord.entryDate).toLocaleDateString()]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:px-8 sm:py-10">
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

      <div className="flex flex-col items-center rounded-xl border border-slate-300 bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{(await getLabSettings()).name}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Case QR code" width={240} height={240} className="my-4" />
        <p className="text-lg font-semibold text-slate-900">{caseRecord.patientName}</p>
        <p className="text-sm text-slate-600">{caseRecord.doctor.name}</p>
        <p className="mt-1 text-xs text-slate-500">{details}</p>
      </div>
    </div>
  );
}
