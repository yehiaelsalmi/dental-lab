import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, canViewCase, requirePermission } from "@/lib/access";
import { CaseFields } from "@/components/CaseFields";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteCase, updateCase } from "../../actions";

export default async function EditCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await requirePermission("case.edit");
  const { id } = await params;
  const { error } = await searchParams;

  const [caseRecord, doctors, ibarDesigners, materials, metalTypes] = await Promise.all([
    prisma.case.findUnique({
      where: { id },
      include: { units: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.ibarDesigner.findMany({ orderBy: { name: "asc" } }),
    prisma.material.findMany({ orderBy: { name: "asc" } }),
    prisma.metalType.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!caseRecord || !canViewCase(access, caseRecord)) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href={`/cases/${caseRecord.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to case
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Edit case</h1>
      <p className="mb-6 text-sm text-slate-500">
        Changing the material, units, metal or ibar designer recalculates the price and fees from
        today&apos;s rates. Other changes leave them as they are. Invoices that were already
        generated don&apos;t change: delete and regenerate them if needed. The Drive folder keeps
        its original name.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form
        action={updateCase}
        className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <input type="hidden" name="caseId" value={caseRecord.id} />
        <CaseFields
          doctors={doctors}
          materials={materials}
          metalTypes={metalTypes}
          ibarDesigners={ibarDesigners}
          defaults={{
            doctorId: caseRecord.doctorId,
            patientName: caseRecord.patientName,
            unitsUpper: caseRecord.unitsUpper,
            unitsLower: caseRecord.unitsLower,
            materialId: caseRecord.materialId,
            metalTypeId: caseRecord.metalTypeId,
            system: caseRecord.system,
            shade: caseRecord.shade,
            dueDate: caseRecord.dueDate,
            ibarDesignerId: caseRecord.ibarDesignerId,
            matchingBy: caseRecord.matchingBy,
            needsPhotogrammetry: caseRecord.needsPhotogrammetry,
            unitCodes: caseRecord.units.map((u) => u.code),
          }}
        />

        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          Notes
          <textarea
            name="notes"
            rows={3}
            defaultValue={caseRecord.notes ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            Save changes
          </button>
          <Link
            href={`/cases/${caseRecord.id}`}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Cancel
          </Link>
        </div>
      </form>

      {can(access, "case.delete") && (
        <section className="mt-8 rounded-xl border border-rose-200 bg-rose-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Delete this case</h2>
          <p className="mb-3 text-sm text-slate-500">
            Removes the case, its review history and notifications from the system. Files already
            in Google Drive are not deleted.
          </p>
          <form action={deleteCase}>
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <ConfirmSubmitButton
              message={`Delete the case for ${caseRecord.patientName}? This can't be undone.`}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
            >
              <Trash2 size={15} />
              Delete case
            </ConfirmSubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
