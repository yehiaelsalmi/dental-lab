"use client";

import { useState } from "react";

const NEW_VALUE = "__new__";
const INPUT =
  "rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export type DoctorOption = { id: string; name: string; phone?: string | null; address?: string | null };

// Doctor picker for the case form: choosing a doctor fills in their saved
// phone and address. A phone typed here (for a new doctor, or one without a
// phone yet) is saved to the doctor, so it's filled in on their next case.
export function DoctorField({ doctors, defaultId }: { doctors: DoctorOption[]; defaultId?: string }) {
  const initial = defaultId ?? (doctors.length === 0 ? NEW_VALUE : "");
  const [selected, setSelected] = useState(initial);
  const saved = doctors.find((d) => d.id === initial);
  const [phone, setPhone] = useState(saved?.phone ?? "");
  const [address, setAddress] = useState(saved?.address ?? "");
  const isNew = selected === NEW_VALUE;
  const doctor = doctors.find((d) => d.id === selected);

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          Doctor
          <select
            name="doctorId"
            required
            value={selected}
            onChange={(e) => {
              const id = e.target.value;
              setSelected(id);
              const d = doctors.find((x) => x.id === id);
              setPhone(d?.phone ?? "");
              setAddress(d?.address ?? "");
            }}
            className={INPUT}
          >
            <option value="" disabled>
              Select doctor
            </option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value={NEW_VALUE}>+ Add new doctor</option>
          </select>
        </label>
        {isNew && (
          <label className="flex flex-col gap-1.5">
            New doctor&apos;s name
            <input name="newDoctorName" required className={INPUT} />
          </label>
        )}
        {(isNew || doctor) && (
          <>
            <label className="flex flex-col gap-1.5">
              Doctor&apos;s phone
              <input
                name="doctorPhone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 01012345678"
                className={INPUT}
              />
              {doctor && !doctor.phone && (
                <span className="text-xs font-normal text-amber-600">
                  No phone saved for this doctor yet. It&apos;s saved for next time.
                </span>
              )}
              {doctor?.phone && (
                <span className="text-xs font-normal text-slate-400">Saved phone. Change it here to update it.</span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              Doctor&apos;s address (optional)
              <input name="doctorAddress" value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
