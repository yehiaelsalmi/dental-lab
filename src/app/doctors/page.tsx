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
    include: { _count: { select: { cases: true, invoices: true, payments: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Doctors</h1>
      <p className="mb-6 text-sm text-slate-500">
        Each doctor&apos;s name, phone number and address (optional). Fix a name or remove a duplicate. New doctors are still added from the New
        Case form. A doctor with cases or invoices can be renamed but not deleted.
      </p>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Doctor saved.</p>
      )}
      {deleted && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {deleted} was deleted.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {doctors.map((d) => {
          const used = d._count.cases + d._count.invoices + d._count.payments > 0;
          return (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
            >
              <form action={renameDoctor} className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1.4fr_auto]">
                <input type="hidden" name="id" value={d.id} />
                <input
                  name="name"
                  defaultValue={d.name}
                  aria-label={`Name for ${d.name}`}
                  className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  name="phone"
                  type="tel"
                  defaultValue={d.phone ?? ""}
                  placeholder="Phone (missing)"
                  aria-label={`Phone for ${d.name}`}
                  className={`min-w-0 rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${
                    d.phone ? "border-slate-300" : "border-amber-300 bg-amber-50 placeholder:text-amber-600"
                  }`}
                />
                <input
                  name="address"
                  defaultValue={d.address ?? ""}
                  placeholder="Address (optional)"
                  aria-label={`Address for ${d.name}`}
                  className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
