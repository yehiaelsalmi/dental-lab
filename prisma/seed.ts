import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_USERS = [
  { name: "Lab Leader", email: "leader@lab.local", password: "ChangeMe123!", role: "LAB_LEADER" },
  { name: "Technician", email: "entry@lab.local", password: "ChangeMe123!", role: "TECHNICIAN" },
  { name: "Designer One", email: "designer1@lab.local", password: "ChangeMe123!", role: "DESIGNER" },
];

async function main() {
  for (const u of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) continue;

    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
    console.log(`Created ${u.role} account: ${u.email} / ${u.password}`);
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
