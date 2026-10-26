-- AlterTable
ALTER TABLE "CaseFile" ADD COLUMN "stage" TEXT;

-- AlterTable
ALTER TABLE "CaseMaterial" ADD COLUMN "pricePerUnit" REAL;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "breakdown" TEXT;


-- Existing case lines take today's material price.
UPDATE "CaseMaterial" SET "pricePerUnit" = (SELECT "pricePerUnit" FROM "Material" WHERE "Material"."id" = "CaseMaterial"."materialId");
