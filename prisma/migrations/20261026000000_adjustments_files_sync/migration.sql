-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "adjustments" TEXT;
ALTER TABLE "InvoiceLine" ADD COLUMN "deduction" REAL;
ALTER TABLE "InvoiceLine" ADD COLUMN "extraFee" REAL;

-- CreateTable
CREATE TABLE "CaseAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseAdjustment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaseFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "driveLink" TEXT NOT NULL,
    "uploadedById" TEXT,
    "folder" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseFile_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CaseFile" ("caseId", "createdAt", "driveFileId", "driveLink", "fileName", "id", "type", "uploadedById") SELECT "caseId", "createdAt", "driveFileId", "driveLink", "fileName", "id", "type", "uploadedById" FROM "CaseFile";
DROP TABLE "CaseFile";
ALTER TABLE "new_CaseFile" RENAME TO "CaseFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CaseAdjustment_caseId_idx" ON "CaseAdjustment"("caseId");


-- Extra fees / deductions so far came from material pricing; keep each case's
-- amounts as list items so its totals don't change.
INSERT INTO "CaseAdjustment" ("id", "caseId", "kind", "amount", "reason", "createdAt")
SELECT lower(hex(randomblob(12))), "id", 'FEE', "extraFee", 'Extra fees (from material pricing)', "createdAt"
FROM "Case" WHERE "extraFee" IS NOT NULL AND "extraFee" > 0;
INSERT INTO "CaseAdjustment" ("id", "caseId", "kind", "amount", "reason", "createdAt")
SELECT lower(hex(randomblob(12))), "id", 'DEDUCTION', "deduction", 'Deduction (from material pricing)', "createdAt"
FROM "Case" WHERE "deduction" IS NOT NULL AND "deduction" > 0;

-- The lab team can delete files from cases.
UPDATE "Role" SET "permissions" = json_insert("permissions", '$[#]', 'case.deleteFiles')
WHERE "key" = 'TECHNICIAN' AND NOT EXISTS (SELECT 1 FROM json_each("Role"."permissions") WHERE value = 'case.deleteFiles');
