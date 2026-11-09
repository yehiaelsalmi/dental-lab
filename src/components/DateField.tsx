"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

// "2026-11-09" -> "09/11/2026"
function toDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// "9/11/2026" or "09/11/2026" -> "2026-11-09"; "" when it isn't a real date.
function toIso(text: string): string {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return "";
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// A date box that always reads and types as DD/MM/YYYY (the browser's own
// date box follows the computer's language), with a calendar button. The form
// still receives the date as YYYY-MM-DD under `name`.
export function DateField({
  name,
  defaultValue,
  required,
  className,
  ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [iso, setIso] = useState(defaultValue ?? "");
  const [text, setText] = useState(toDisplay(defaultValue ?? ""));
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        aria-label={ariaLabel}
        required={required}
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          const parsed = toIso(value);
          setIso(parsed);
          e.target.setCustomValidity(value.trim() && !parsed ? "Enter the date as DD/MM/YYYY." : "");
        }}
        className={`${className ?? ""} w-full pr-10`}
      />
      <button
        type="button"
        aria-label="Pick a date"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700"
      >
        <CalendarDays size={16} />
      </button>
      {/* The browser's calendar, opened by the button; its value is copied over. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso}
        onChange={(e) => {
          setIso(e.target.value);
          setText(toDisplay(e.target.value));
        }}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
      <input type="hidden" name={name} value={iso} />
    </div>
  );
}
