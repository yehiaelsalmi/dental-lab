-- CreateTable
CREATE TABLE "InventoryBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unitsMilled" INTEGER NOT NULL DEFAULT 0,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryBlock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "colour" TEXT,
    "size" TEXT,
    "code" TEXT,
    "ref" TEXT,
    "scalingFactor" TEXT,
    "trackBlocks" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_InventoryItem" ("code", "colour", "createdAt", "id", "minQuantity", "name", "notes", "quantity", "ref", "scalingFactor", "size", "type", "updatedAt") SELECT "code", "colour", "createdAt", "id", "minQuantity", "name", "notes", "quantity", "ref", "scalingFactor", "size", "type", "updatedAt" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE UNIQUE INDEX "InventoryItem_code_key" ON "InventoryItem"("code");
CREATE TABLE "new_InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "units" INTEGER,
    "change" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "note" TEXT,
    "lot" TEXT,
    "expiresAt" DATETIME,
    "madeAt" DATETIME,
    "blockId" TEXT,
    "caseId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "InventoryBlock" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryMovement" ("caseId", "change", "createdAt", "createdById", "expiresAt", "id", "itemId", "kind", "lot", "madeAt", "note", "quantityAfter") SELECT "caseId", "change", "createdAt", "createdById", "expiresAt", "id", "itemId", "kind", "lot", "madeAt", "note", "quantityAfter" FROM "InventoryMovement";
DROP TABLE "InventoryMovement";
ALTER TABLE "new_InventoryMovement" RENAME TO "InventoryMovement";
CREATE INDEX "InventoryMovement_itemId_idx" ON "InventoryMovement"("itemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBlock_code_key" ON "InventoryBlock"("code");

-- CreateIndex
CREATE INDEX "InventoryBlock_itemId_idx" ON "InventoryBlock"("itemId");

