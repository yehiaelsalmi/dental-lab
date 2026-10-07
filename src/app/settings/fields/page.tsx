import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { FIELD_TYPES, parseOptions } from "@/lib/customFields";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { createField, deleteField, moveField, toggleFieldArchived, updateField } from "./actions";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const typeLabel = (key: string) => FIELD_TYPES.find((t) => t.key === key)?.label ?? key;

export default async function CustomFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePermission("page.fields");
  const { error, saved } = await searchParams;

  const [fields, counts] = await Promise.all([
    prisma.customField.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.caseFieldValue.groupBy({ by: ["fieldId"], _count: { _all: true } }),
  ]);
  const used = (id: string) => counts.find((c) => c.fieldId === id)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Custom fields</h1>
      <p className="mb-6 text-sm text-slate-500">
        Add your own fields to the New Case and Edit forms, such as &quot;Implant brand&quot; or
        &quot;Jig needed?&quot;. Values show on the case page, in Reports and in the Excel export.
      </p>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add a field</h2>
        <form action={createField} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Name
            <input name="label" required placeholder="e.g. Implant brand" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Type
            <select name="type" defaultValue="TEXT" className={INPUT}>
              {FIELD_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 sm:col-span-2">
            Dropdown options (only for Dropdown fields, one per line)
            <textarea name="options" rows={3} placeholder={"Nobel\nStraumann\nMIS"} className={INPUT} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="required" className="h-4 w-4 accent-brand" />
            Required (must be filled in)
          </label>
          <button
            type="submit"
            className="justify-self-start rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover sm:justify-self-end"
          >
            Add field
          </button>
        </form>
      </section>

      <h2 className="mb-3 text-sm font-semibold text-slate-900">Fields, in the order they appear</h2>
      <ul className="flex flex-col gap-3">
        {fields.map((f, i) => {
          const count = used(f.id);
          return (
            <li key={f.id} className={`rounded-xl border bg-white p-4 ${f.archived ? "border-dashed border-slate-300 opacity-70" : "border-slate-200"}`}>
              <form action={updateField} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="id" value={f.id} />
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                  {typeLabel(f.type)}
                  {f.archived && " (archived)"}
                  <input name="label" required defaultValue={f.label} className={INPUT} />
                </label>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                    <input type="checkbox" name="required" defaultChecked={f.required} className="h-4 w-4 accent-brand" />
                    Required
                  </label>
                  <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                    Save
                  </button>
                </div>
                {f.type === "SELECT" && (
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 sm:col-span-2">
                    Options (one per line)
                    <textarea name="options" rows={3} defaultValue={parseOptions(f.options).join("\n")} className={INPUT} />
                  </label>
                )}
              </form>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>Filled in on {count} case{count === 1 ? "" : "s"}</span>
                <div className="flex items-center gap-4">
                  <MoveButton id={f.id} direction="up" disabled={i === 0} />
                  <MoveButton id={f.id} direction="down" disabled={i === fields.length - 1} />
                  <form action={toggleFieldArchived}>
                    <input type="hidden" name="id" value={f.id} />
                    <button type="submit" className="font-medium text-slate-600 hover:text-slate-900">
                      {f.archived ? "Unarchive" : "Archive"}
                    </button>
                  </form>
                  {count === 0 && (
                    <form action={deleteField}>
                      <input type="hidden" name="id" value={f.id} />
                      <ConfirmSubmitButton
                        message={`Delete the field "${f.label}"?`}
                        className="flex items-center gap-1 font-medium text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 size={13} />
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {fields.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            No custom fields yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function MoveButton({ id, direction, disabled }: { id: string; direction: "up" | "down"; disabled: boolean }) {
  return (
    <form action={moveField}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Move up" : "Move down"}
        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
      >
        {direction === "up" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      </button>
    </form>
  );
}
