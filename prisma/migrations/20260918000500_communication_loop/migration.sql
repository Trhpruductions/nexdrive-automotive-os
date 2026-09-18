-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CannedService" ADD COLUMN     "intervalMiles" INTEGER,
ADD COLUMN     "intervalMonths" INTEGER;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "dailyDigest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestHour" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "lastDigestAt" TIMESTAMP(3),
ADD COLUMN     "smsNumber" TEXT;

-- AlterTable
ALTER TABLE "WorkOrderLine" ADD COLUMN     "cannedServiceId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkOrderLine" ADD CONSTRAINT "WorkOrderLine_cannedServiceId_fkey" FOREIGN KEY ("cannedServiceId") REFERENCES "CannedService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

