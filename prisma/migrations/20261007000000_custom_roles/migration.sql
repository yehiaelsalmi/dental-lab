-- DropIndex
DROP INDEX "Ceramist_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Ceramist";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "caseScope" TEXT NOT NULL DEFAULT 'ALL',
    "visibleStatuses" TEXT NOT NULL DEFAULT '[]',
    "notifyOn" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Built-in roles (same as ROLE_PRESETS in src/lib/permissions.ts)
INSERT INTO "Role" ("id", "key", "name", "permissions", "caseScope", "visibleStatuses", "notifyOn") VALUES ('role_lab_leader', 'LAB_LEADER', 'Lab Leader', '["case.create","case.edit","case.delete","case.assign","files.drive","work.design","work.ceramist","case.review","case.ibar","case.matching","case.milling","case.stainGlaze","case.deliver","case.photogrammetry","money.viewAll","money.viewOwn","page.designers","page.ceramists","page.reports","page.invoices","page.users","page.roles","page.pricing","page.drive"]', 'ALL', '[]', '[]');
INSERT INTO "Role" ("id", "key", "name", "permissions", "caseScope", "visibleStatuses", "notifyOn") VALUES ('role_technician', 'TECHNICIAN', 'Technician', '["case.create","case.edit","case.assign","files.drive","case.ibar","case.matching","case.milling","case.stainGlaze","case.deliver","case.photogrammetry"]', 'ALL', '[]', '[]');
INSERT INTO "Role" ("id", "key", "name", "permissions", "caseScope", "visibleStatuses", "notifyOn") VALUES ('role_designer', 'DESIGNER', 'Designer', '["work.design","money.viewOwn"]', 'OWN', '[]', '[]');
INSERT INTO "Role" ("id", "key", "name", "permissions", "caseScope", "visibleStatuses", "notifyOn") VALUES ('role_photogrammetry', 'PHOTOGRAMMETRY', 'Photogrammetry', '["case.photogrammetry","money.viewOwn"]', 'PHOTOGRAMMETRY', '[]', '["PHOTOGRAMMETRY_NEEDED"]');
INSERT INTO "Role" ("id", "key", "name", "permissions", "caseScope", "visibleStatuses", "notifyOn") VALUES ('role_ceramist', NULL, 'Ceramist', '["work.ceramist","case.stainGlaze","money.viewOwn"]', 'OWN', '[]', '["STAIN_AND_GLAZE"]');

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
    "materialId" TEXT,
    "metalTypeId" TEXT,
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
    CONSTRAINT "Case_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_metalTypeId_fkey" FOREIGN KEY ("metalTypeId") REFERENCES "MetalType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_assignedDesignerId_fkey" FOREIGN KEY ("assignedDesignerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("assignedDesignerId", "ceramistFee", "ceramistId", "createdAt", "createdById", "deduction", "designerFee", "doctorId", "driveFolderId", "driveFolderUrl", "dueDate", "entryDate", "extraFee", "firstDesignerFee", "firstDesignerId", "ibarDesignerId", "ibarDoneAt", "ibarFee", "id", "matchingBy", "materialId", "metalCost", "metalTypeId", "millingCost", "needsPhotogrammetry", "notes", "patientName", "photogrammetryCost", "photogrammetryDoneAt", "shade", "status", "system", "totalPrice", "unitsLower", "unitsUpper", "updatedAt") SELECT "assignedDesignerId", "ceramistFee", NULL, "createdAt", "createdById", "deduction", "designerFee", "doctorId", "driveFolderId", "driveFolderUrl", "dueDate", "entryDate", "extraFee", "firstDesignerFee", "firstDesignerId", "ibarDesignerId", "ibarDoneAt", "ibarFee", "id", "matchingBy", "materialId", "metalCost", "metalTypeId", "millingCost", "needsPhotogrammetry", "notes", "patientName", "photogrammetryCost", "photogrammetryDoneAt", "shade", "status", "system", "totalPrice", "unitsLower", "unitsUpper", "updatedAt" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "name", "passwordHash", "roleId") SELECT "active", "createdAt", "email", "id", "name", "passwordHash",
  CASE "role"
    WHEN 'LAB_LEADER' THEN 'role_lab_leader'
    WHEN 'DESIGNER' THEN 'role_designer'
    WHEN 'PHOTOGRAMMETRY' THEN 'role_photogrammetry'
    ELSE 'role_technician'
  END
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

