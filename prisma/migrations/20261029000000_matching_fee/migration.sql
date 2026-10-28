-- Matching and milling fees per unit, paid to the people assigned to the
-- Matching and Milling roles.
ALTER TABLE "Material" ADD COLUMN "matchingFeePerUnit" REAL;
ALTER TABLE "Material" ADD COLUMN "millingFeePerUnit" REAL;

-- Mark the lab's Matching and Milling roles.
UPDATE "Role" SET "key" = 'MATCHING'
WHERE "key" IS NULL AND lower(trim("name")) = 'matching'
  AND NOT EXISTS (SELECT 1 FROM "Role" WHERE "key" = 'MATCHING');
UPDATE "Role" SET "key" = 'MILLING'
WHERE "key" IS NULL AND lower(trim("name")) = 'milling'
  AND NOT EXISTS (SELECT 1 FROM "Role" WHERE "key" = 'MILLING');
