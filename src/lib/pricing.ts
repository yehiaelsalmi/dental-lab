type MaterialRates = {
  pricePerUnit: number;
  ceramistFeePerUnit: number;
  designerFeePerUnit: number;
  ibarFeePerUnit: number | null;
  extraFee: number | null;
  deduction: number | null;
  millingCostPerUnit: number | null;
  photogrammetryCostPerUnit: number | null;
};

// The amounts locked onto a case. A fee is only charged when someone is
// actually assigned to do that part of the work.
export function computeCasePricing(input: {
  material: MaterialRates;
  metalCostPerUnit: number | null;
  unitCount: number;
  hasDesigner: boolean;
  hasFirstDesigner: boolean;
  hasCeramist: boolean;
  hasIbarDesigner: boolean;
  needsPhotogrammetry: boolean;
}) {
  const { material, metalCostPerUnit, unitCount } = input;
  return {
    totalPrice:
      material.pricePerUnit * unitCount + (material.extraFee ?? 0) - (material.deduction ?? 0),
    extraFee: material.extraFee,
    deduction: material.deduction,
    designerFee: input.hasDesigner ? material.designerFeePerUnit * unitCount : null,
    // Both designers on an ibar case earn the full designer fee.
    firstDesignerFee: input.hasFirstDesigner ? material.designerFeePerUnit * unitCount : null,
    ceramistFee: input.hasCeramist ? material.ceramistFeePerUnit * unitCount : null,
    ibarFee:
      input.hasIbarDesigner && material.ibarFeePerUnit != null
        ? material.ibarFeePerUnit * unitCount
        : null,
    metalCost: metalCostPerUnit != null ? metalCostPerUnit * unitCount : null,
    millingCost:
      material.millingCostPerUnit != null ? material.millingCostPerUnit * unitCount : null,
    photogrammetryCost:
      input.needsPhotogrammetry && material.photogrammetryCostPerUnit != null
        ? material.photogrammetryCostPerUnit * unitCount
        : null,
  };
}
