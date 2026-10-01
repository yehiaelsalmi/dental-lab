// Amounts are shown as whole Egyptian pounds everywhere: "30,000 EGP".
export function formatEGP(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${Math.round(value).toLocaleString("en-US")} EGP`;
}
