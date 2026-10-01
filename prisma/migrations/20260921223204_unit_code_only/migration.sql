/*
  Warnings:

  - You are about to drop the column `price` on the `CaseUnit` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaseUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caseId" TEXT NOT NULL,
    CONSTRAINT "CaseUnit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CaseUnit" ("caseId", "code", "createdAt", "id") SELECT "caseId", "code", "createdAt", "id" FROM "CaseUnit";
DROP TABLE "CaseUnit";
ALTER TABLE "new_CaseUnit" RENAME TO "CaseUnit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
