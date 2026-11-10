// A doctor's phone: digits with optional spaces, dashes, brackets and a
// leading +. Returns the cleaned number, or throws a readable error.
export function cleanPhone(value: unknown, required: boolean): string | null {
  const text = String(value ?? "").trim();
  if (!text) {
    if (required) throw new Error("Enter the doctor's phone number.");
    return null;
  }
  if (!/^\+?[\d\s()-]{6,20}$/.test(text) || (text.match(/\d/g) ?? []).length < 6) {
    throw new Error("Enter a valid phone number (digits, e.g. 01012345678).");
  }
  return text.replace(/\s+/g, " ");
}

export function cleanAddress(value: unknown): string | null {
  return String(value ?? "").trim().slice(0, 300) || null;
}
