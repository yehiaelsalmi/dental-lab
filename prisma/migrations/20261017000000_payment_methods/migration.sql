-- How each payment was made (Cash, InstaPay, ...).
ALTER TABLE "DoctorPayment" ADD COLUMN "method" TEXT;
ALTER TABLE "StaffPayment" ADD COLUMN "method" TEXT;
