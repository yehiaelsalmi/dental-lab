// Reads medical-device barcodes (UDI) scanned on material boxes, so every box
// of the same product is recognised and its lot / dates are filled in.
//
// Two formats are common on dental materials:
//  - HIBC ("+EDDIG8440051/$6162549130/16D20251206/14D20351205K"): maker ID
//    (4), product number, pack level (1 digit), then "/" fields: "$" lot,
//    "16D" made on YYYYMMDD, "14D" expires YYYYMMDD; last char is a check.
//  - GS1 ("(01)04012345678901(17)271231(10)LOT1" or the same without
//    brackets): 01 = product (GTIN), 17 = expiry YYMMDD, 11 = made on,
//    10 = lot, 21 = serial.

export type ScannedCode = {
  // What identifies the product (the same on every box of it).
  productKey: string;
  ref?: string; // the maker's product / REF number
  lot?: string;
  expires?: string; // YYYY-MM-DD
  made?: string; // YYYY-MM-DD
  format: "HIBC" | "GS1" | "PLAIN";
};

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function yyyymmdd(s: string): string | undefined {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? iso(+m[1], +m[2], +m[3]) : undefined;
}

// GS1 YYMMDD; day 00 means the end of that month.
function yymmdd(s: string): string | undefined {
  const m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return undefined;
  const y = 2000 + +m[1];
  const month = +m[2];
  const day = +m[3] || new Date(Date.UTC(y, month, 0)).getUTCDate();
  return iso(y, month, day);
}

// A scanner set to a German keyboard on an English computer types "]" for
// "+" and "&" for "/"; fix those for HIBC codes.
function unscramble(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("]") && /^\][A-Z0-9]{5,}/i.test(s)) s = "+" + s.slice(1);
  if (s.startsWith("+")) s = s.replace(/&/g, "/");
  return s;
}

function parseHibc(s: string): ScannedCode | null {
  if (!/^\+[A-Z0-9]{4}[A-Z0-9]/i.test(s)) return null;
  const body = s.slice(1).toUpperCase();
  const parts = body.split("/");
  let primary = parts[0];
  const secondary = parts.slice(1);
  // Without "/" fields the last char of the primary is the check character.
  if (secondary.length === 0) primary = primary.slice(0, -1);
  if (primary.length < 6) return null;
  const maker = primary.slice(0, 4);
  const ref = primary.slice(4, -1);
  const result: ScannedCode = { productKey: `+${primary}`, ref: `${maker} ${ref}`, format: "HIBC" };
  secondary.forEach((field, i) => {
    // The very last field ends with the check character.
    const f = i === secondary.length - 1 ? field.slice(0, -1) : field;
    if (f.startsWith("16D")) result.made = yyyymmdd(f.slice(3));
    else if (f.startsWith("14D")) result.expires = yyyymmdd(f.slice(3));
    else if (f.startsWith("$$3")) {
      result.expires = yymmdd(f.slice(3, 9));
      result.lot = f.slice(9) || undefined;
    } else if (f.startsWith("$$") && /^\$\$\d{4}/.test(f)) {
      // MMYY then lot
      const mm = +f.slice(2, 4);
      const yy = 2000 + +f.slice(4, 6);
      result.expires = iso(yy, mm, new Date(Date.UTC(yy, mm, 0)).getUTCDate());
      result.lot = f.slice(6) || undefined;
    } else if (f.startsWith("$")) result.lot = f.slice(1) || undefined;
    else if (f.startsWith("S")) {
      // serial number: not needed for stock
    }
  });
  return result;
}

const GS1_FIXED: Record<string, number> = { "01": 14, "17": 6, "11": 6, "15": 6 };

function parseGs1(raw: string): ScannedCode | null {
  // "(01)…(17)…(10)…" or raw "01…17…10…" (group separators may be missing).
  let s = raw.replace(/^\]d2|^\]C1|^\]Q3/, "");
  const fields: Record<string, string> = {};
  if (s.startsWith("(")) {
    for (const m of s.matchAll(/\((\d{2,4})\)([^(]*)/g)) fields[m[1]] = m[2];
  } else {
    if (!/^01\d{14}/.test(s)) return null;
    while (s.length >= 2) {
      const ai = s.slice(0, 2);
      if (GS1_FIXED[ai]) {
        fields[ai] = s.slice(2, 2 + GS1_FIXED[ai]);
        s = s.slice(2 + GS1_FIXED[ai]);
      } else if (ai === "10" || ai === "21") {
        const end = s.indexOf("\u001d", 2);
        // Without a separator, a variable field runs to the next date AI or the end.
        const rest = end === -1 ? s.slice(2) : s.slice(2, end);
        const stop = end === -1 ? rest.search(/(?:17|11)\d{6}$/) : -1;
        fields[ai] = stop > 0 ? rest.slice(0, stop) : rest;
        s = end === -1 ? (stop > 0 ? rest.slice(stop) : "") : s.slice(end + 1);
      } else break;
    }
  }
  const gtin = fields["01"];
  if (!gtin || !/^\d{14}$/.test(gtin)) return null;
  return {
    productKey: `01${gtin}`,
    ref: `GTIN ${gtin}`,
    lot: fields["10"] || undefined,
    expires: fields["17"] ? yymmdd(fields["17"]) : undefined,
    made: fields["11"] ? yymmdd(fields["11"]) : undefined,
    format: "GS1",
  };
}

export function parseScannedCode(raw: string): ScannedCode {
  const s = unscramble(raw);
  return parseHibc(s) ?? parseGs1(s) ?? { productKey: s, format: "PLAIN" };
}
