import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteDoctor, renameDoctor } from "./actions";

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  await requirePermission("page.doctors");
  const { error, saved, deleted } = await searchParams;

  const doctors = await prisma.doctor.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { cases: true, invoices: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Doctors</h1>
      <p className="mb-6 text-sm text-slate-500">
        Fix a doctor&apos;s name or remove a duplicate. New doctors are still added from the New
        Case form. A doctor with cases or invoices can be renamed but not deleted.
      </p>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Name saved.</p>
      )}
      {deleted && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {deleted} was deleted.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {doctors.map((d) => {
          const used = d._count.cases + d._count.invoices > 0;
          return (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
            >
              <form action={renameDoctor} className="flex flex-1 gap-2">
                <input type="hidden" name="id" value={d.id} />
                <input
                  name="name"
                  defaultValue={d.name}
                  aria-label={`Name for ${d.name}`}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save
                </button>
              </form>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="text-xs text-slate-500">
                  {d._count.cases} case{d._count.cases === 1 ? "" : "s"}
                </span>
                {!used && (
                  <form action={deleteDoctor}>
                    <input type="hidden" name="id" value={d.id} />
                    <ConfirmSubmitButton
                      message={`Delete the doctor "${d.name}"?`}
                      className="flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 size={14} />
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </li>
          );
        })}
        {doctors.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            No doctors yet.
          </li>
        )}
      </ul>
    </div>
  );
}
