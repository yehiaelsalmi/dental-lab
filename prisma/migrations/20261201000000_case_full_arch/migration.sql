-- Full arch tick box on cases.
ALTER TABLE "Case" ADD COLUMN "fullArch" BOOLEAN NOT NULL DEFAULT false;
