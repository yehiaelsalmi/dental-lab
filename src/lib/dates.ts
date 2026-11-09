// Every date in the app is shown as D/M/Y (e.g. 09/11/2026), in the lab's
// time zone. Dates picked from a calendar are stored as midnight UTC, which
// is still the same day in Cairo.
const LAB_TIME_ZONE = "Africa/Cairo";

function parts(value: Date | string | number) {
  const date = new Date(value);
  const get = (type: string, p: Intl.DateTimeFormatPart[]) => p.find((x) => x.type === type)?.value ?? "";
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return { day: get("day", p), month: get("month", p), year: get("year", p), hour: get("hour", p), minute: get("minute", p) };
}

// 09/11/2026
export function formatDate(value: Date | string | number): string {
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year}`;
}

// 09/11/2026, 14:30
export function formatDateTime(value: Date | string | number): string {
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}`;
}
