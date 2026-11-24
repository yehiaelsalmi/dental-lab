-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "scalingFactor" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "unitsPerBlock" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "note" TEXT,
    "lot" TEXT,
    "expiresAt" DATETIME,
    "madeAt" DATETIME,
    "caseId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryMovement" ("change", "createdAt", "createdById", "expiresAt", "id", "itemId", "kind", "lot", "madeAt", "note", "quantityAfter") SELECT "change", "createdAt", "createdById", "expiresAt", "id", "itemId", "kind", "lot", "madeAt", "note", "quantityAfter" FROM "InventoryMovement";
DROP TABLE "InventoryMovement";
ALTER TABLE "new_InventoryMovement" RENAME TO "InventoryMovement";
CREATE INDEX "InventoryMovement_itemId_idx" ON "InventoryMovement"("itemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Items get the system's own codes (INV00001, ...) for their QR labels; a
-- maker's code already saved moves to the old "ref" column.
UPDATE "InventoryItem" SET "ref" = COALESCE("ref", "code") WHERE "code" IS NOT NULL AND "code" NOT LIKE 'INV%';
UPDATE "InventoryItem" SET "code" = 'INV' || substr('00000' || (
  SELECT COUNT(*) FROM "InventoryItem" i2 WHERE i2."createdAt" < "InventoryItem"."createdAt"
    OR (i2."createdAt" = "InventoryItem"."createdAt" AND i2."id" <= "InventoryItem"."id")
), -5);

-- The Milling role sees stock and takes materials for cases.
UPDATE "Role" SET "permissions" = json_insert("permissions", '$[#]', 'inventory.use')
WHERE "key" = 'MILLING' AND NOT EXISTS (SELECT 1 FROM json_each("Role"."permissions") WHERE value = 'inventory.use');
