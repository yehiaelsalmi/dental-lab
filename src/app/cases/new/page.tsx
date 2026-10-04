import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { FileDropField } from "@/components/FileDropField";
import { CaseFields } from "@/components/CaseFields";
import { createCase } from "../actions";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("TECHNICIAN", "LAB_LEADER");
  const { error } = await searchParams;

  const [designers, doctors, ibarDesigners, materials, metalTypes] = await Promise.all([
    prisma.user.findMany({ where: { role: "DESIGNER", active: true }, orderBy: { name: "asc" } }),
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.ibarDesigner.findMany({ orderBy: { name: "asc" } }),
    prisma.material.findMany({ orderBy: { name: "asc" } }),
    prisma.metalType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href="/cases"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to cases
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">New Case</h1>
      <p className="mb-6 text-sm text-slate-500">Log a case sent in from a doctor.</p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form
        action={createCase}
        className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <CaseFields
          doctors={doctors}
          materials={materials}
          metalTypes={metalTypes}
          ibarDesigners={ibarDesigners}
        />

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Assignment &amp; notes</h2>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Assign designer
              <select
                name="assignedDesignerId"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                defaultValue=""
              >
                <option value="">Unassigned</option>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Notes
              <textarea
                name="notes"
                rows={3}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Scan from doctor</h2>
          <FileDropField name="scanFile" hint="ZIP or PDF, uploaded straight to the case's Drive folder" />
        </div>

        <button
          type="submit"
          className="self-start rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          Create Case
        </button>
      </form>
    </div>
  );
}

