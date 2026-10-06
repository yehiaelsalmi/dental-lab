"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type Option = { id: string; name: string };
export type MaterialLineDefault = {
  arch: string;
  materialId: string;
  units: number;
  metalTypeId: string | null;
};

type Row = { key: number } & MaterialLineDefault;

const SELECT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// The case's material lines: each row is Upper/Lower + material + units + an
// optional metal. Submitted as parallel lineArch / lineMaterialId / lineUnits /
// lineMetalTypeId fields (parsed by parseLineInputs).
export function MaterialLinesField({
  materials,
  metalTypes,
  defaultLines,
}: {
  materials: Option[];
  metalTypes: Option[];
  defaultLines?: MaterialLineDefault[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (defaultLines?.length
      ? defaultLines
      : [{ arch: "UPPER", materialId: "", units: 0, metalTypeId: null }]
    ).map((l, i) => ({ ...l, key: i }))
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const addRow = () => {
    // A new line starts on the arch of the last one, which is usually what's next.
    const lastArch = rows[rows.length - 1]?.arch ?? "UPPER";
    setRows([...rows, { key: nextKey, arch: lastArch, materialId: "", units: 0, metalTypeId: null }]);
    setNextKey(nextKey + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      {materials.length === 0 && (
        <p className="text-xs text-amber-600">Add materials and their rates in Pricing first.</p>
      )}
      {rows.map((row, i) => (
        <div
          key={row.key}
          className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[110px_1fr_90px_1fr_auto] sm:items-end sm:border-0 sm:p-0"
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Arch
            <select name="lineArch" defaultValue={row.arch} className={SELECT}>
              <option value="UPPER">Upper</option>
              <option value="LOWER">Lower</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Units
            <input
              name="lineUnits"
              type="number"
              min={1}
              required
              defaultValue={row.units || undefined}
              className={SELECT}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-slate-500 sm:col-span-1 sm:row-start-1 sm:col-start-2">
            Material
            <select name="lineMaterialId" required defaultValue={row.materialId} className={SELECT}>
              <option value="" disabled>
                Select material
              </option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Metal
            <select name="lineMetalTypeId" defaultValue={row.metalTypeId ?? ""} className={SELECT}>
              <option value="">None</option>
              {metalTypes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
            disabled={rows.length === 1}
            aria-label={`Remove material line ${i + 1}`}
            className="flex items-center justify-center self-end rounded-lg border border-slate-300 px-3 py-2.5 text-slate-400 hover:bg-slate-50 hover:text-rose-600 disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-brand hover:text-brand-hover"
      >
        <Plus size={15} />
        Add material
      </button>
      <p className="text-xs text-slate-500">
        Add a line for each material on each arch, e.g. Upper Zirconia 10 units and Upper PMMA 2
        units.
      </p>
    </div>
  );
}
