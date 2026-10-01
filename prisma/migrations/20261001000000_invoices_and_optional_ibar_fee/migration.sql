-- RedefineTables: make Material.ibarFeePerUnit optional
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "ceramistFeePerUnit" REAL NOT NULL,
    "designerFeePerUnit" REAL NOT NULL,
    "ibarFeePerUnit" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Material" ("id", "name", "pricePerUnit", "ceramistFeePerUnit", "designerFeePerUnit", "ibarFeePerUnit", "createdAt")
SELECT "id", "name", "pricePerUnit", "ceramistFeePerUnit", "designerFeePerUnit", "ibarFeePerUnit", "createdAt" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doctorId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    CONSTRAINT "Invoice_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_doctorId_periodStart_key" ON "Invoice"("doctorId", "periodStart");

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientName" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "caseId" TEXT,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
