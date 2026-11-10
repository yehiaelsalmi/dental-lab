-- CreateTable
CREATE TABLE "PrintRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "models" INTEGER NOT NULL,
    "prints" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PrintRecord_caseId_idx" ON "PrintRecord"("caseId");

-- CreateIndex
CREATE INDEX "PrintRecord_createdAt_idx" ON "PrintRecord"("createdAt");

