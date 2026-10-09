import { EntitySelect } from "@/components/EntitySelect";
import { UnitCodesField } from "@/components/UnitCodesField";
import { MaterialLinesField, type MaterialLineDefault } from "@/components/MaterialLinesField";
import { fieldInputName, type FieldDef } from "@/lib/customFields";

type Option = { id: string; name: string };

export type CaseFieldDefaults = {
  doctorId?: string;
  patientName?: string;
  lines?: MaterialLineDefault[];
  fieldValues?: Record<string, string>;
  system?: string | null;
  shade?: string | null;
  dueDate?: Date | null;
  ibarDesignerId?: string | null;
  matchingBy?: string | null;
  needsPhotogrammetry?: boolean;
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
  customFields = [],
  defaults = {},
}: {
  customFields?: FieldDef[];
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
          <Field
            label="Matching after try-in (optional)"
            name="matchingBy"
            placeholder="Name of who does the matching"
            defaultValue={defaults.matchingBy ?? undefined}
          />
          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              name="needsPhotogrammetry"
              defaultChecked={defaults.needsPhotogrammetry}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              <span className="font-medium">Needs photogrammetry</span>
              <span className="block text-xs text-slate-500">
                The photogrammetry team gets an app and email notification.
              </span>
            </span>
          </label>
        </div>
      </div>

      {customFields.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">More details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {customFields.map((f) => (
              <CustomFieldInput key={f.id} field={f} value={defaults.fieldValues?.[f.id]} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Materials</h2>
        <MaterialLinesField materials={materials} metalTypes={metalTypes} defaultLines={defaults.lines} />
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

// One of the lab's own fields (Custom fields page), by type.
function CustomFieldInput({ field, value }: { field: FieldDef; value?: string }) {
  const name = fieldInputName(field.id);
  const label = `${field.label}${field.required ? "" : " (optional)"}`;
  if (field.type === "CHECKBOX") {
    return (
      <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
        <input type="checkbox" name={name} defaultChecked={value === "yes"} className="h-4 w-4 accent-brand" />
        {field.label}
      </label>
    );
  }
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-medium text-slate-700 ${field.type === "LONGTEXT" ? "sm:col-span-2" : ""}`}>
      {label}
      {field.type === "LONGTEXT" ? (
        <textarea name={name} rows={3} required={field.required} defaultValue={value} className={INPUT_CLASS} />
      ) : field.type === "SELECT" ? (
        <select name={name} required={field.required} defaultValue={value ?? ""} className={INPUT_CLASS}>
          <option value="">{field.required ? "Select" : "None"}</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
          step={field.type === "NUMBER" ? "any" : undefined}
          required={field.required}
          defaultValue={value}
          className={INPUT_CLASS}
        />
      )}
    </label>
  );
}
