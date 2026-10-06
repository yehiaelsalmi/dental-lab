-- CreateTable
CREATE TABLE "CaseMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "arch" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "metalTypeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseMaterial_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CaseMaterial_metalTypeId_fkey" FOREIGN KEY ("metalTypeId") REFERENCES "MetalType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Each existing case's single material becomes one line per arch with units
-- (or one Upper line when no units were entered).
INSERT INTO "CaseMaterial" ("id", "caseId", "arch", "materialId", "units", "metalTypeId", "createdAt")
SELECT lower(hex(randomblob(12))), "id", 'UPPER', "materialId", "unitsUpper", "metalTypeId", "createdAt"
FROM "Case" WHERE "materialId" IS NOT NULL AND COALESCE("unitsUpper", 0) > 0;
INSERT INTO "CaseMaterial" ("id", "caseId", "arch", "materialId", "units", "metalTypeId", "createdAt")
SELECT lower(hex(randomblob(12))), "id", 'LOWER', "materialId", "unitsLower", "metalTypeId", "createdAt"
FROM "Case" WHERE "materialId" IS NOT NULL AND COALESCE("unitsLower", 0) > 0;
INSERT INTO "CaseMaterial" ("id", "caseId", "arch", "materialId", "units", "metalTypeId", "createdAt")
SELECT lower(hex(randomblob(12))), "id", 'UPPER', "materialId", 0, "metalTypeId", "createdAt"
FROM "Case" WHERE "materialId" IS NOT NULL AND COALESCE("unitsUpper", 0) = 0 AND COALESCE("unitsLower", 0) = 0;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientName" TEXT NOT NULL,
    "unitsUpper" INTEGER,
    "unitsLower" INTEGER,
    "system" TEXT,
    "shade" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY_FOR_DESIGN',
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "notes" TEXT,
    "matchingBy" TEXT,
    "needsPhotogrammetry" BOOLEAN NOT NULL DEFAULT false,
    "photogrammetryDoneAt" DATETIME,
    "photogrammetryDoneById" TEXT,
    "driveFolderId" TEXT,
    "driveFolderUrl" TEXT,
    "doctorId" TEXT NOT NULL,
    "ceramistId" TEXT,
    "ibarDesignerId" TEXT,
    "firstDesignerId" TEXT,
    "ibarDoneAt" DATETIME,
    "totalPrice" REAL,
    "extraFee" REAL,
    "deduction" REAL,
    "ceramistFee" REAL,
    "designerFee" REAL,
    "firstDesignerFee" REAL,
    "ibarFee" REAL,
    "metalCost" REAL,
    "millingCost" REAL,
    "photogrammetryCost" REAL,
    "createdById" TEXT NOT NULL,
    "assignedDesignerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_photogrammetryDoneById_fkey" FOREIGN KEY ("photogrammetryDoneById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_ceramistId_fkey" FOREIGN KEY ("ceramistId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_ibarDesignerId_fkey" FOREIGN KEY ("ibarDesignerId") REFERENCES "IbarDesigner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_firstDesignerId_fkey" FOREIGN KEY ("firstDesignerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_assignedDesignerId_fkey" FOREIGN KEY ("assignedDesignerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("assignedDesignerId", "ceramistFee", "ceramistId", "createdAt", "createdById", "deduction", "designerFee", "doctorId", "driveFolderId", "driveFolderUrl", "dueDate", "entryDate", "extraFee", "firstDesignerFee", "firstDesignerId", "ibarDesignerId", "ibarDoneAt", "ibarFee", "id", "matchingBy", "metalCost", "millingCost", "needsPhotogrammetry", "notes", "patientName", "photogrammetryCost", "photogrammetryDoneAt", "photogrammetryDoneById", "shade", "status", "system", "totalPrice", "unitsLower", "unitsUpper", "updatedAt") SELECT "assignedDesignerId", "ceramistFee", "ceramistId", "createdAt", "createdById", "deduction", "designerFee", "doctorId", "driveFolderId", "driveFolderUrl", "dueDate", "entryDate", "extraFee", "firstDesignerFee", "firstDesignerId", "ibarDesignerId", "ibarDoneAt", "ibarFee", "id", "matchingBy", "metalCost", "millingCost", "needsPhotogrammetry", "notes", "patientName", "photogrammetryCost", "photogrammetryDoneAt", "photogrammetryDoneById", "shade", "status", "system", "totalPrice", "unitsLower", "unitsUpper", "updatedAt" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

