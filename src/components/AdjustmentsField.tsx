"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// Extra fees / deductions on the New Case form: any number of rows, each
// with an amount and a reason. Empty rows are ignored.
export function AdjustmentsField() {
  const [rows, setRows] = useState<number[]>([]);
  const [next, setNext] = useState(0);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((id) => (
        <div key={id} className="grid grid-cols-[120px_110px_1fr_auto] items-center gap-2">
          <select name="adjKind" defaultValue="FEE" aria-label="Type" className={INPUT}>
            <option value="FEE">Extra fee</option>
            <option value="DEDUCTION">Deduction</option>
          </select>
          <input name="adjAmount" type="number" min={1} step="0.01" required placeholder="EGP" aria-label="Amount" className={INPUT} />
          <input name="adjReason" required maxLength={120} placeholder="Reason, e.g. Rush order" aria-label="Reason" className={INPUT} />
          <button
            type="button"
            onClick={() => setRows(rows.filter((r) => r !== id))}
            className="p-1.5 text-slate-400 hover:text-rose-600"
            aria-label="Remove"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows([...rows, next]);
          setNext(next + 1);
        }}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-brand hover:text-brand-hover"
      >
        <Plus size={15} />
        Add extra fee or deduction
      </button>
    </div>
  );
}
