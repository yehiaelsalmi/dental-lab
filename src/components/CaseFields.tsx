import { EntitySelect } from "@/components/EntitySelect";
import { UnitCodesField } from "@/components/UnitCodesField";

type Option = { id: string; name: string };

export type CaseFieldDefaults = {
  doctorId?: string;
  patientName?: string;
  unitsUpper?: number | null;
  unitsLower?: number | null;
  materialId?: string | null;
  metalTypeId?: string | null;
  system?: string | null;
  shade?: string | null;
  dueDate?: Date | null;
  ibarDesignerId?: string | null;
  unitCodes?: string[];
};

const INPUT_CLASS =
  "rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// The case details and unit codes sections, shared by the new and edit forms.
export function CaseFields({
  doctors,
  materials,
  metalTypes,
  ibarDesigners,
  defaults = {},
}: {
  doctors: Option[];
  materials: Option[];
  metalTypes: Option[];
  ibarDesigners: Option[];
  defaults?: CaseFieldDefaults;
}) {
  return (
    <>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Case details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EntitySelect
            label="Doctor"
            idField="doctorId"
            newNameField="newDoctorName"
            items={doctors}
            addLabel="+ Add new doctor"
            defaultId={defaults.doctorId}
          />
          <Field label="Patient" name="patientName" required defaultValue={defaults.patientName} />
          <Field
            label="Units (Upper)"
            name="unitsUpper"
            type="number"
            defaultValue={defaults.unitsUpper ?? undefined}
          />
          <Field
            label="Units (Lower)"
            name="unitsLower"
            type="number"
            defaultValue={defaults.unitsLower ?? undefined}
          />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Material
            <select
              name="materialId"
              required
              defaultValue={defaults.materialId ?? ""}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                {materials.length === 0 ? "No materials set up yet" : "Select material"}
              </option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {materials.length === 0 && (
              <span className="text-xs font-normal text-amber-600">
                Add materials and their rates in Pricing first.
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Metal
            <select name="metalTypeId" defaultValue={defaults.metalTypeId ?? ""} className={INPUT_CLASS}>
              <option value="">None</option>
              {metalTypes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="System"
            name="system"
            placeholder="e.g. Roott, natural"
            defaultValue={defaults.system ?? undefined}
          />
          <Field label="Shade" name="shade" defaultValue={defaults.shade ?? undefined} />
          <Field
            label="Due date"
            name="dueDate"
            type="date"
            defaultValue={defaults.dueDate ? defaults.dueDate.toISOString().slice(0, 10) : undefined}
          />
          <EntitySelect
            label="Ibar designer"
            idField="ibarDesignerId"
            newNameField="newIbarDesignerName"
            items={ibarDesigners}
            addLabel="+ Add new ibar designer"
            optional
            defaultId={defaults.ibarDesignerId ?? undefined}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Unit codes</h2>
        <UnitCodesField defaultCodes={defaults.unitCodes} />
      </div>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={INPUT_CLASS}
      />
    </label>
  );
}
