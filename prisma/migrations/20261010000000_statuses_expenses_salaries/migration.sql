-- AlterTable
ALTER TABLE "User" ADD COLUMN "baseSalary" REAL;

-- CreateTable
CREATE TABLE "CustomStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "afterStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "month" DATETIME NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "endMonth" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomStatus_key_key" ON "CustomStatus"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CustomStatus_label_key" ON "CustomStatus"("label");


-- Technicians can add statuses and move cases between them (as requested).
UPDATE "Role"
SET "permissions" = json_insert(json_insert("permissions", '$[#]', 'case.setStatus'), '$[#]', 'page.statuses')
WHERE "id" = 'role_technician' AND "permissions" NOT LIKE '%case.setStatus%';
