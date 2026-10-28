// Brings every case's Matching / Milling fee up to date with the materials'
// current fees (same rules as saving a material on Pricing).
//   npx tsx scripts/refresh-role-fees.ts          # show what would change
//   npx tsx scripts/refresh-role-fees.ts --apply  # save it
import { PrismaClient } from "@prisma/client";
import { refreshMaterialRoleFees } from "@/lib/roleFees";
import { pricedLinesForCase } from "@/lib/caseMaterials";
import { matchingFeeFor, millingFeeFor } from "@/lib/pricing";
import { MATCHING_ROLE_KEY, MILLING_ROLE_KEY } from "@/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  if (process.argv.includes("--apply")) {
    let updated = 0;
    for (const m of await prisma.material.findMany()) updated += await refreshMaterialRoleFees(m.id);
    console.log(`Updated ${updated} assignment fees.`);
    return;
  }
  const assignments = await prisma.caseAssignment.findMany({
    where: { role: { key: { in: [MATCHING_ROLE_KEY, MILLING_ROLE_KEY] } } },
    include: { role: true, user: true, case: { select: { patientName: true, status: true } } },
  });
  for (const a of assignments) {
    if (a.case.status === "DELIVERED" && a.fee != null) continue;
    const lines = await pricedLinesForCase(a.caseId);
    const fee = a.role.key === MATCHING_ROLE_KEY ? matchingFeeFor(lines) : millingFeeFor(lines);
    if (fee !== a.fee) console.log(`${a.role.name.padEnd(9)} ${a.user.name.padEnd(16)} ${a.case.patientName.padEnd(28)} ${a.fee ?? "-"} -> ${fee ?? "-"}`);
  }
  console.log("Dry run: nothing saved.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
