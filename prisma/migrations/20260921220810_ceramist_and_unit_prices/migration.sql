-- CreateTable
CREATE TABLE "Ceramist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CaseUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caseId" TEXT NOT NULL,
    CONSTRAINT "CaseUnit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "ceramistId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedDesignerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_ceramistId_fkey" FOREIGN KEY ("ceramistId") REFERENCES "Ceramist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_assignedDesignerId_fkey" FOREIGN KEY ("assignedDesignerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("assignedDesignerId", "createdAt", "createdById", "doctorId", "driveFolderId", "driveFolderUrl", "dueDate", "entryDate", "id", "material", "notes", "patientName", "shade", "status", "system", "unitsLower", "unitsUpper", "updatedAt") SELECT "assignedDesignerId", "createdAt", "createdById", "doctorId", "driveFolderId", "driveFolderUrl", "dueDate", "entryDate", "id", "material", "notes", "patientName", "shade", "status", "system", "unitsLower", "unitsUpper", "updatedAt" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Ceramist_name_key" ON "Ceramist"("name");
