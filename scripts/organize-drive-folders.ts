// One-off: gives every existing case folder its subfolders and moves each
// file the app uploaded into the right one (same rules as new uploads).
//   npx tsx scripts/organize-drive-folders.ts          # show the plan only
//   npx tsx scripts/organize-drive-folders.ts --apply  # create folders, move files
import { PrismaClient } from "@prisma/client";
import { CASE_SUBFOLDERS, subfolderForExistingFile } from "@/lib/caseFolders";
import { ensureCaseSubfolders, moveFileToFolder } from "@/lib/googleDrive";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const cases = await prisma.case.findMany({
    where: { driveFolderId: { not: null } },
    include: { files: { orderBy: { createdAt: "asc" } }, workSubmissions: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${apply ? "APPLYING" : "DRY RUN"}: ${cases.length} case folders`);

  let moved = 0;
  let failed = 0;
  for (const c of cases) {
    console.log(`\n${c.patientName} (${c.id})`);
    const folders = apply ? await ensureCaseSubfolders(c.driveFolderId!) : null;
    for (const f of c.files) {
      const role = c.workSubmissions.find((w) => w.fileId === f.id)?.roleName;
      const target = subfolderForExistingFile(f, c, role);
      if (!target) {
        console.log(`  stays    ${f.type.padEnd(14)} ${f.fileName}`);
        continue;
      }
      console.log(`  -> ${CASE_SUBFOLDERS[target].padEnd(36)} ${f.type.padEnd(14)} ${f.fileName}`);
      if (!folders) continue;
      try {
        if (await moveFileToFolder(f.driveFileId, folders[target])) moved++;
      } catch (error) {
        failed++;
        console.log(`     FAILED: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  console.log(apply ? `\nDone: ${moved} files moved, ${failed} failed.` : "\nNothing changed (dry run).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
