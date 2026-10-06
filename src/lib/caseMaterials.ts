import { prisma } from "@/lib/prisma";
import type { PricedLine } from "@/lib/pricing";

export const ARCHES = ["UPPER", "LOWER"] as const;
export type Arch = (typeof ARCHES)[number];
export const ARCH_LABELS: Record<Arch, string> = { UPPER: "Upper", LOWER: "Lower" };

export type LineInput = { arch: Arch; materialId: string; units: number; metalTypeId: string | null };

// Reads the material lines from the case form (parallel lineArch / lineMaterialId
// / lineUnits / lineMetalTypeId fields, one entry per row).
export function parseLineInputs(formData: FormData): LineInput[] {
  const arches = formData.getAll("lineArch").map(String);
  const materials = formData.getAll("lineMaterialId").map(String);
  const units = formData.getAll("lineUnits").map(String);
  const metals = formData.getAll("lineMetalTypeId").map(String);

  const lines: LineInput[] = [];
  arches.forEach((arch, i) => {
    const materialId = (materials[i] ?? "").trim();
    const unitText = (units[i] ?? "").trim();
    if (!materialId && !unitText) return; // an empty row
    if (!materialId) throw new Error(`Pick a material on line ${i + 1}.`);
    if (arch !== "UPPER" && arch !== "LOWER") throw new Error(`Pick Upper or Lower on line ${i + 1}.`);
    const n = Number(unitText);
    if (!Number.isInteger(n) || n < 1) throw new Error(`Enter the number of units on line ${i + 1}.`);
    lines.push({ arch, materialId, units: n, metalTypeId: (metals[i] ?? "").trim() || null });
  });
  if (lines.length === 0) throw new Error("Add at least one material.");
  return lines;
}

// Loads the rates for the lines (checking each material and metal exists).
export async function priceLines(lines: LineInput[]): Promise<PricedLine[]> {
  const [materials, metals] = await Promise.all([
    prisma.material.findMany({ where: { id: { in: lines.map((l) => l.materialId) } } }),
    prisma.metalType.findMany({
      where: { id: { in: lines.flatMap((l) => (l.metalTypeId ? [l.metalTypeId] : [])) } },
    }),
  ]);
  return lines.map((l, i) => {
    const material = materials.find((m) => m.id === l.materialId);
    if (!material) throw new Error(`The material on line ${i + 1} no longer exists.`);
    const metal = l.metalTypeId ? metals.find((m) => m.id === l.metalTypeId) : null;
    if (l.metalTypeId && !metal) throw new Error(`The metal on line ${i + 1} no longer exists.`);
    return { material, metalCostPerUnit: metal?.cost ?? null, units: l.units };
  });
}

// The rates for a case's saved lines, e.g. to lock a fee when someone is assigned.
export async function pricedLinesForCase(caseId: string): Promise<PricedLine[]> {
  const lines = await prisma.caseMaterial.findMany({
    where: { caseId },
    include: { material: true, metalType: true },
  });
  return lines.map((l) => ({ material: l.material, metalCostPerUnit: l.metalType?.cost ?? null, units: l.units }));
}

export function unitTotals(lines: { arch: string; units: number }[]) {
  const sum = (arch: Arch) => lines.filter((l) => l.arch === arch).reduce((s, l) => s + l.units, 0);
  const upper = sum("UPPER");
  const lower = sum("LOWER");
  return { unitsUpper: upper || null, unitsLower: lower || null };
}

// A stable description of the lines, to tell whether an edit changed them.
export function linesKey(lines: { arch: string; materialId: string; units: number; metalTypeId: string | null }[]) {
  return lines
    .map((l) => `${l.arch}|${l.materialId}|${l.units}|${l.metalTypeId ?? ""}`)
    .sort()
    .join(";");
}

type NamedLine = { arch: string; units: number; material: { name: string }; metalType: { name: string } | null };

// "Zirconia (U10, L12), PMMA (U2)" for tables, invoices and labels.
export function materialSummary(lines: NamedLine[]): string {
  const byMaterial = new Map<string, string[]>();
  for (const l of lines) {
    const parts = byMaterial.get(l.material.name) ?? [];
    parts.push(`${l.arch === "UPPER" ? "U" : "L"}${l.units}`);
    byMaterial.set(l.material.name, parts);
  }
  return [...byMaterial].map(([name, parts]) => `${name} (${parts.join(", ")})`).join(", ");
}

export function metalSummary(lines: NamedLine[]): string {
  return [...new Set(lines.flatMap((l) => (l.metalType ? [l.metalType.name] : [])))].join(", ");
}
