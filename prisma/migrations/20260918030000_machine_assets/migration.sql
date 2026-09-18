-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "autoWorkOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hoursMetric" TEXT NOT NULL DEFAULT 'run_hours';

-- CreateIndex
CREATE UNIQUE INDEX "Machine_assetId_key" ON "Machine"("assetId");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

