"use client";

import { useState } from "react";

const NEW_VALUE = "__new__";

// A dropdown of existing names with a "+ Add new" option that reveals a text
// field. Submits `${name}Id` (an id, "", or "__new__") and `new${Name}Name`.
export function EntitySelect({
  label,
  idField,
  newNameField,
  items,
  addLabel,
  optional,
  defaultId,
}: {
  label: string;
  idField: string;
  newNameField: string;
  items: { id: string; name: string }[];
  addLabel: string;
  optional?: boolean;
  defaultId?: string;
}) {
  const [addingNew, setAddingNew] = useState(!optional && items.length === 0);

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <select
        name={idField}
        required={!optional}
        defaultValue={addingNew ? NEW_VALUE : (defaultId ?? "")}
        onChange={(e) => setAddingNew(e.target.value === NEW_VALUE)}
        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="" disabled={!optional}>
          {optional ? "None" : `Select ${label.toLowerCase()}`}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        <option value={NEW_VALUE}>{addLabel}</option>
      </select>

      {addingNew && (
        <input
          type="text"
          name={newNameField}
          required
          placeholder={`${label}'s name`}
          className="mt-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      )}
    </div>
  );
}
