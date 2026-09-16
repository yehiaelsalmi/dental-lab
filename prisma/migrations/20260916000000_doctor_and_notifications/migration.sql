-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_name_key" ON "Doctor"("name");

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill: turn each distinct existing Case.doctorName into a Doctor row
INSERT INTO "Doctor" ("id", "name", "createdAt")
SELECT
    lower(hex(randomblob(4)) || hex(randomblob(4)) || hex(randomblob(4))),
    "doctorName",
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "doctorName" FROM "Case");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientName" TEXT NOT NULL,
    "unitsUpper" INTEGER,
    "unitsLower" INTEGER,
    "material" TEXT,
    "system" TEXT,
    "shade" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY_FOR_DESIGN',
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "notes" TEXT,
    "driveFolderId" TEXT,
    "driveFolderUrl" TEXT,
    "doctorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedDesignerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_assignedDesignerId_fkey" FOREIGN KEY ("assignedDesignerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" (
    "id", "patientName", "unitsUpper", "unitsLower", "material", "system", "shade",
    "status", "entryDate", "dueDate", "notes", "driveFolderId", "driveFolderUrl",
    "doctorId", "createdById", "assignedDesignerId", "createdAt", "updatedAt"
)
SELECT
    "Case"."id", "patientName", "unitsUpper", "unitsLower", "material", "system", "shade",
    "status", "entryDate", "dueDate", "notes", "driveFolderId", "driveFolderUrl",
    (SELECT "Doctor"."id" FROM "Doctor" WHERE "Doctor"."name" = "Case"."doctorName"),
    "createdById", "assignedDesignerId", "createdAt", "updatedAt"
FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
