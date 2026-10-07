import { prisma } from "@/lib/prisma";

export const FIELD_TYPES = [
  { key: "TEXT", label: "Short text" },
  { key: "LONGTEXT", label: "Long text" },
  { key: "NUMBER", label: "Number" },
  { key: "SELECT", label: "Dropdown" },
  { key: "CHECKBOX", label: "Yes / No" },
  { key: "DATE", label: "Date" },
] as const;
export type FieldType = (typeof FIELD_TYPES)[number]["key"];

export type FieldDef = {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
};

export function parseOptions(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((o) => typeof o === "string") : [];
  } catch {
    return [];
  }
}

// Fields shown on the case forms, in the lab's order.
export async function activeFields(): Promise<FieldDef[]> {
  const rows = await prisma.customField.findMany({
    where: { archived: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((f) => ({ ...f, options: parseOptions(f.options) }));
}

export const fieldInputName = (id: string) => `cf_${id}`;

// Reads and checks the custom field values from a case form. Empty values are
// returned as null (they're deleted on save).
export function parseFieldValues(formData: FormData, fields: FieldDef[]): { fieldId: string; value: string | null }[] {
  return fields.map((f) => {
    const raw = String(formData.get(fieldInputName(f.id)) ?? "").trim();
    let value: string | null = raw || null;
    if (f.type === "CHECKBOX") value = raw === "on" ? "yes" : null;
    if (value && f.type === "NUMBER" && !Number.isFinite(Number(value))) {
      throw new Error(`${f.label} must be a number.`);
    }
    if (value && f.type === "SELECT" && !f.options.includes(value)) {
      throw new Error(`Pick one of the options for ${f.label}.`);
    }
    if (value && f.type === "DATE" && Number.isNaN(Date.parse(value))) {
      throw new Error(`${f.label} must be a date.`);
    }
    if (!value && f.required && f.type !== "CHECKBOX") throw new Error(`${f.label} is required.`);
    return { fieldId: f.id, value };
  });
}

// Saves a case's custom field values (creating, updating or clearing each one).
export async function saveFieldValues(caseId: string, values: { fieldId: string; value: string | null }[]) {
  for (const { fieldId, value } of values) {
    if (value == null) {
      await prisma.caseFieldValue.deleteMany({ where: { caseId, fieldId } });
    } else {
      await prisma.caseFieldValue.upsert({
        where: { caseId_fieldId: { caseId, fieldId } },
        create: { caseId, fieldId, value },
        update: { value },
      });
    }
  }
}

export function formatFieldValue(type: string, value: string | null | undefined): string {
  if (!value) return "-";
  if (type === "CHECKBOX") return value === "yes" ? "Yes" : "No";
  if (type === "DATE") return new Date(value).toLocaleDateString();
  return value;
}
