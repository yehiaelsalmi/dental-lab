import { prisma } from "@/lib/prisma";
import { pricedLinesForCase } from "@/lib/caseMaterials";
import { matchingFeeFor, millingFeeFor } from "@/lib/pricing";
import { MATCHING_ROLE_KEY, MILLING_ROLE_KEY } from "@/lib/permissions";

// After a material's matching / milling fee is saved on Pricing, brings the
// Matching and Milling fees of the cases using it up to date. Fees on cases
// not delivered yet follow the current price; delivered cases only get a fee
// filled in if they never had one, so past months' reports don't change when
// a price changes later. Returns how many assignments were updated.
export async function refreshMaterialRoleFees(materialId: string): Promise<number> {
  const assignments = await prisma.caseAssignment.findMany({
    where: {
      role: { key: { in: [MATCHING_ROLE_KEY, MILLING_ROLE_KEY] } },
      case: { materials: { some: { materialId } } },
    },
    include: { role: { select: { key: true } }, case: { select: { status: true } } },
  });

  let updated = 0;
  for (const a of assignments) {
    if (a.case.status === "DELIVERED" && a.fee != null) continue;
    const lines = await pricedLinesForCase(a.caseId);
    const fee = a.role.key === MATCHING_ROLE_KEY ? matchingFeeFor(lines) : millingFeeFor(lines);
    if (fee === a.fee) continue;
    await prisma.caseAssignment.update({ where: { id: a.id }, data: { fee } });
    updated++;
  }
  return updated;
}
