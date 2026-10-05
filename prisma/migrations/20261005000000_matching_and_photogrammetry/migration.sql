-- AlterTable
ALTER TABLE "Material" ADD COLUMN "millingCostPerUnit" REAL;
ALTER TABLE "Material" ADD COLUMN "photogrammetryCostPerUnit" REAL;

-- AlterTable
ALTER TABLE "Case" ADD COLUMN "matchingBy" TEXT;
ALTER TABLE "Case" ADD COLUMN "needsPhotogrammetry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Case" ADD COLUMN "photogrammetryDoneAt" DATETIME;
ALTER TABLE "Case" ADD COLUMN "millingCost" REAL;
ALTER TABLE "Case" ADD COLUMN "photogrammetryCost" REAL;
