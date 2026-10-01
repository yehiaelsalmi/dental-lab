-- CreateTable
CREATE TABLE "IbarDesigner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "IbarDesigner_name_key" ON "IbarDesigner"("name");

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "ceramistFeePerUnit" REAL NOT NULL,
    "designerFeePerUnit" REAL NOT NULL,
    "ibarFeePerUnit" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");

-- CreateTable
CREATE TABLE "MetalType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MetalType_name_key" ON "MetalType"("name");

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
    "driveFolderId" TEXT,
    "driveFolderUrl" TEXT,
    "doctorId" TEXT NOT NULL,
    "ceramistId" TEXT,
    "ibarDesignerId" TEXT,
    "materialId" TEXT,
    "metalTypeId" TEXT,
    "totalPrice" REAL,
    "ceramistFee" REAL,
    "designerFee" REAL,
    "ibarFee" REAL,
    "metalCost" REAL,
    "createdById" TEXT NOT NULL,
    "assignedDesignerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_ceramistId_fkey" FOREIGN KEY ("ceramistId") REFERENCES "Ceramist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_ibarDesignerId_fkey" FOREIGN KEY ("ibarDesignerId") REFERENCES "IbarDesigner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_metalTypeId_fkey" FOREIGN KEY ("metalTypeId") REFERENCES "MetalType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_assignedDesignerId_fkey" FOREIGN KEY ("assignedDesignerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" (
    "id", "patientName", "unitsUpper", "unitsLower", "system", "shade",
    "status", "entryDate", "dueDate", "notes", "driveFolderId", "driveFolderUrl",
    "doctorId", "ceramistId", "createdById", "assignedDesignerId", "createdAt", "updatedAt"
)
SELECT
    "id", "patientName", "unitsUpper", "unitsLower", "system", "shade",
    "status", "entryDate", "dueDate", "notes", "driveFolderId", "driveFolderUrl",
    "doctorId", "ceramistId", "createdById", "assignedDesignerId", "createdAt", "updatedAt"
FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
