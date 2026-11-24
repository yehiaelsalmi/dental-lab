-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "ref" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "InventoryMovement" ADD COLUMN "lot" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "madeAt" DATETIME;

