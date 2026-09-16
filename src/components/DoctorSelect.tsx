"use client";

import { useState } from "react";

const NEW_DOCTOR_VALUE = "__new__";

export function DoctorSelect({ doctors }: { doctors: { id: string; name: string }[] }) {
  const [addingNew, setAddingNew] = useState(doctors.length === 0);

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      Doctor
      <select
        name="doctorId"
        required
        defaultValue={addingNew ? NEW_DOCTOR_VALUE : ""}
        onChange={(e) => setAddingNew(e.target.value === NEW_DOCTOR_VALUE)}
        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="" disabled>
          Select a doctor
        </option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
        <option value={NEW_DOCTOR_VALUE}>+ Add new doctor</option>
      </select>

      {addingNew && (
        <input
          type="text"
          name="newDoctorName"
          required
          placeholder="Doctor's name"
          className="mt-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      )}
    </div>
  );
}
