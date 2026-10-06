type MaterialRates = {
  id: string;
  pricePerUnit: number;
  ceramistFeePerUnit: number;
  designerFeePerUnit: number;
  ibarFeePerUnit: number | null;
  extraFee: number | null;
  deduction: number | null;
  millingCostPerUnit: number | null;
  photogrammetryCostPerUnit: number | null;
};

// One material line on a case (see the CaseMaterial model).
export type PricedLine = {
  material: MaterialRates;
  metalCostPerUnit: number | null;
  units: number;
};

// Sums an optional per-unit rate over the lines; null when no line has it.
function sumRate(lines: PricedLine[], rate: (line: PricedLine) => number | null): number | null {
  let total: number | null = null;
  for (const line of lines) {
    const perUnit = rate(line);
    if (perUnit != null) total = (total ?? 0) + perUnit * line.units;
  }
  return total;
}

// Each material's flat amounts apply once per case, however many lines use it.
function sumFlat(lines: PricedLine[], value: (m: MaterialRates) => number | null): number | null {
  const seen = new Map(lines.map((l) => [l.material.id, l.material]));
  let total: number | null = null;
  for (const material of seen.values()) {
    const v = value(material);
    if (v != null) total = (total ?? 0) + v;
  }
  return total;
}

export function designerFeeFor(lines: PricedLine[]): number {
  return sumRate(lines, (l) => l.material.designerFeePerUnit) ?? 0;
}

export function ceramistFeeFor(lines: PricedLine[]): number {
  return sumRate(lines, (l) => l.material.ceramistFeePerUnit) ?? 0;
}

// The amounts locked onto a case. A fee is only charged when someone is
// actually assigned to do that part of the work.
export function computeCasePricing(input: {
  lines: PricedLine[];
  hasDesigner: boolean;
  hasFirstDesigner: boolean;
  hasCeramist: boolean;
  hasIbarDesigner: boolean;
  needsPhotogrammetry: boolean;
}) {
  const { lines } = input;
  const extraFee = sumFlat(lines, (m) => m.extraFee);
  const deduction = sumFlat(lines, (m) => m.deduction);
  return {
    totalPrice:
      (sumRate(lines, (l) => l.material.pricePerUnit) ?? 0) + (extraFee ?? 0) - (deduction ?? 0),
    extraFee,
    deduction,
    designerFee: input.hasDesigner ? designerFeeFor(lines) : null,
    // Both designers on an ibar case earn the full designer fee.
    firstDesignerFee: input.hasFirstDesigner ? designerFeeFor(lines) : null,
    ceramistFee: input.hasCeramist ? ceramistFeeFor(lines) : null,
    ibarFee: input.hasIbarDesigner ? sumRate(lines, (l) => l.material.ibarFeePerUnit) : null,
    metalCost: sumRate(lines, (l) => l.metalCostPerUnit),
    millingCost: sumRate(lines, (l) => l.material.millingCostPerUnit),
    photogrammetryCost: input.needsPhotogrammetry
      ? sumRate(lines, (l) => l.material.photogrammetryCostPerUnit)
      : null,
  };
}
