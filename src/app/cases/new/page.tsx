import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { FileDropField } from "@/components/FileDropField";
import { createCase } from "../actions";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("DATA_ENTRY", "LAB_LEADER");
  const { error } = await searchParams;

  const designers = await prisma.user.findMany({
    where: { role: "DESIGNER", active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
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
        className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Case details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Doctor" name="doctorName" required />
            <Field label="Patient" name="patientName" required />
            <Field label="Units (Upper)" name="unitsUpper" type="number" />
            <Field label="Units (Lower)" name="unitsLower" type="number" />
            <Field label="Material" name="material" placeholder="e.g. Zirconia" />
            <Field label="System" name="system" placeholder="e.g. Roott, natural" />
            <Field label="Shade" name="shade" />
            <Field label="Due date" name="dueDate" type="date" />
          </div>
        </div>

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

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
