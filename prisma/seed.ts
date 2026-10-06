import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_PRESETS } from "../src/lib/permissions";

const prisma = new PrismaClient();

const SEED_USERS = [
  { name: "Lab Leader", email: "leader@lab.local", password: "ChangeMe123!", roleId: "role_lab_leader" },
  { name: "Technician", email: "entry@lab.local", password: "ChangeMe123!", roleId: "role_technician" },
  { name: "Designer One", email: "designer1@lab.local", password: "ChangeMe123!", roleId: "role_designer" },
];

async function main() {
  // The built-in roles normally come from the migration; this covers a
  // database created some other way.
  for (const r of ROLE_PRESETS) {
    await prisma.role.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        key: r.key,
        name: r.name,
        permissions: JSON.stringify(r.permissions),
        caseScope: r.caseScope,
        visibleStatuses: JSON.stringify(r.visibleStatuses),
        notifyOn: JSON.stringify(r.notifyOn),
      },
    });
  }

  for (const u of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) continue;

    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: { name: u.name, email: u.email, passwordHash, roleId: u.roleId },
    });
    console.log(`Created account: ${u.email} / ${u.password}`);
  }

  console.log("\nChange these passwords after first login.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
