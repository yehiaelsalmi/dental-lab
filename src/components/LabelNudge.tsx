"use client";

import { useEffect, useRef } from "react";

const KEY = "labelOffsetMm";

// Moves the print on the sticker (in mm) for a label printer that prints a bit
// off to one side. Saved in this browser, since each printer differs.
export function LabelNudge() {
  const dxRef = useRef<HTMLInputElement>(null);
  const dyRef = useRef<HTMLInputElement>(null);

  function apply(dx: number, dy: number) {
    document.documentElement.style.setProperty("--label-dx", `${dx}mm`);
    document.documentElement.style.setProperty("--label-dy", `${dy}mm`);
  }

  useEffect(() => {
    let dx = 0;
    let dy = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved && typeof saved.dx === "number" && typeof saved.dy === "number") ({ dx, dy } = saved);
    } catch {}
    if (dxRef.current) dxRef.current.value = String(dx);
    if (dyRef.current) dyRef.current.value = String(dy);
    apply(dx, dy);
  }, []);

  function changed() {
    const dx = Number(dxRef.current?.value) || 0;
    const dy = Number(dyRef.current?.value) || 0;
    apply(dx, dy);
    try {
      localStorage.setItem(KEY, JSON.stringify({ dx, dy }));
    } catch {}
  }

  function reset() {
    if (dxRef.current) dxRef.current.value = "0";
    if (dyRef.current) dyRef.current.value = "0";
    changed();
  }

  const input = "w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900";
  return (
    <div className="mx-auto mb-4 max-w-md rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 print:hidden">
      <p className="mb-2 font-medium text-slate-800">Print lands off the sticker? Move it (mm)</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          Left (−) / right (+)
          <input ref={dxRef} type="number" step={0.5} min={-20} max={20} defaultValue={0} onChange={changed} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          Up (−) / down (+)
          <input ref={dyRef} type="number" step={0.5} min={-20} max={20} defaultValue={0} onChange={changed} className={input} />
        </label>
        <button type="button" onClick={reset} className="pb-1.5 font-medium text-slate-500 hover:text-slate-900">
          Reset
        </button>
      </div>
      <p className="mt-2 text-slate-500">
        E.g. if the print starts 10 mm too far right, enter −10. Saved on this computer for next time.
      </p>
    </div>
  );
}
