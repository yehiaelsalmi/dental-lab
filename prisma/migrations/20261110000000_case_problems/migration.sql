-- CreateTable
CREATE TABLE "CaseProblem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solvedAt" DATETIME,
    "solvedById" TEXT,
    CONSTRAINT "CaseProblem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseProblem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CaseProblem_solvedById_fkey" FOREIGN KEY ("solvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CaseProblem_caseId_idx" ON "CaseProblem"("caseId");


-- Problems can be reported on cases in the lab's "Problems" status.
INSERT OR IGNORE INTO "AppSetting" ("key", "value")
SELECT 'status.problems', COALESCE(json_group_array("key"), '[]')
FROM "CustomStatus" WHERE lower(trim("label")) IN ('problems', 'problem');
