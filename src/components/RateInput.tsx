export function RateInput({
  name,
  label,
  type = "number",
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: "number" | "text";
  required?: boolean;
  defaultValue?: string | number | null;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        {...(type === "number" ? { step: "0.01", min: "0" } : {})}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
