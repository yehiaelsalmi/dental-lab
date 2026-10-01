"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function UnitCodesField() {
  const [rows, setRows] = useState([0]);
  const [nextId, setNextId] = useState(1);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((rowId) => (
        <div key={rowId} className="flex items-center gap-2">
          <input
            name="unitCode"
            placeholder="Unit code"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="button"
            onClick={() => setRows((r) => (r.length === 1 ? r : r.filter((id) => id !== rowId)))}
            disabled={rows.length === 1}
            aria-label="Remove unit"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows((r) => [...r, nextId]);
          setNextId((n) => n + 1);
        }}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-brand hover:text-brand-hover"
      >
        <Plus size={15} />
        Add unit
      </button>
    </div>
  );
}
