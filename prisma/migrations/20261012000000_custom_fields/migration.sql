-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CaseFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "CaseFieldValue_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_label_key" ON "CustomField"("label");

-- CreateIndex
CREATE UNIQUE INDEX "CaseFieldValue_caseId_fieldId_key" ON "CaseFieldValue"("caseId", "fieldId");

