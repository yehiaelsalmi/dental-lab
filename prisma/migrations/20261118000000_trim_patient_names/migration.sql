-- Patient names were saved with stray spaces at the ends (which also stopped
-- the new-case scan from finding its case). Drive folders already use the
-- trimmed names.
UPDATE "Case" SET "patientName" = trim("patientName") WHERE "patientName" <> trim("patientName");
