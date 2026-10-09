-- Printing / try-in workflow.
ALTER TABLE "Case" ADD COLUMN "productionMethod" TEXT;
ALTER TABLE "Case" ADD COLUMN "printForTryIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Case" ADD COLUMN "tryInDoneAt" DATETIME;

-- Every case approved before this change went to milling.
UPDATE "Case" SET "productionMethod" = 'MILLING'
WHERE "status" IN ('MILLING', 'STAIN_AND_GLAZE', 'COMPLETED', 'DELIVERED');

-- The lab team reviews designs, marks printing done and uploads try-in scans;
-- the Printing role marks printing done.
UPDATE "Role" SET "permissions" = json_insert("permissions", '$[#]', 'case.review')
WHERE "key" = 'TECHNICIAN' AND NOT EXISTS (SELECT 1 FROM json_each("Role"."permissions") WHERE value = 'case.review');
UPDATE "Role" SET "permissions" = json_insert("permissions", '$[#]', 'case.printing')
WHERE ("key" = 'TECHNICIAN' OR "name" = 'Printing') AND NOT EXISTS (SELECT 1 FROM json_each("Role"."permissions") WHERE value = 'case.printing');
UPDATE "Role" SET "permissions" = json_insert("permissions", '$[#]', 'case.tryIn')
WHERE "key" = 'TECHNICIAN' AND NOT EXISTS (SELECT 1 FROM json_each("Role"."permissions") WHERE value = 'case.tryIn');
