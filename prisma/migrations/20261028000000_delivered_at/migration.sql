-- AlterTable
ALTER TABLE "Case" ADD COLUMN "deliveredAt" DATETIME;


-- Cases already delivered: the exact date wasn't recorded, so use the last
-- time the case was changed.
UPDATE "Case" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED';
