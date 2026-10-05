"use client";

// A <select> that submits its form as soon as the choice changes, so a GET
// filter form (search, status, sort) applies without pressing a button.
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  label,
  className,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
