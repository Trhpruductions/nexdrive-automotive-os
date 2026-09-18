-- CreateEnum
CREATE TYPE "PartKind" AS ENUM ('STOCK', 'MATERIAL', 'PRODUCT');

-- CreateEnum
CREATE TYPE "DieStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PLANNED', 'RELEASED', 'RUNNING', 'PAUSED', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'SHIPPED');

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_workOrderId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "shipmentId" TEXT,
ALTER COLUMN "workOrderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "customerPartNumber" TEXT,
ADD COLUMN     "dieId" TEXT,
ADD COLUMN     "kind" "PartKind" NOT NULL DEFAULT 'STOCK',
ADD COLUMN     "materialPartId" TEXT,
ADD COLUMN     "materialPerPiece" DECIMAL(12,4),
ADD COLUMN     "packQty" INTEGER,
ADD COLUMN     "pressId" TEXT,
ADD COLUMN     "stdRatePerHour" INTEGER,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'ea';

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "jobSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shipSeq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "shifts" JSONB;

-- CreateTable
CREATE TABLE "Die" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DieStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "hitsAtService" INTEGER NOT NULL DEFAULT 0,
    "serviceIntervalHits" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "machineId" TEXT,
    "assetId" TEXT,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "Die_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJob" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "good" INTEGER NOT NULL DEFAULT 0,
    "scrap" INTEGER NOT NULL DEFAULT 0,
    "shipped" INTEGER NOT NULL DEFAULT 0,
    "materialUsed" DECIMAL(12,4),
    "customerPo" TEXT,
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "machineId" TEXT,
    "dieId" TEXT,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "ProductionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRun" (
    "id" TEXT NOT NULL,
    "shift" TEXT,
    "operator" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "good" INTEGER NOT NULL DEFAULT 0,
    "scrap" INTEGER NOT NULL DEFAULT 0,
    "downtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "downtimeReason" TEXT,
    "notes" TEXT,
    "jobId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "dieId" TEXT,
    "technicianId" TEXT,

    CONSTRAINT "ProductionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "shipDate" TIMESTAMP(3),
    "carrier" TEXT,
    "tracking" TEXT,
    "shipTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLine" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipmentId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "jobId" TEXT,

    CONSTRAINT "ShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Die_assetId_key" ON "Die"("assetId");

-- CreateIndex
CREATE INDEX "Die_shopId_idx" ON "Die"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Die_shopId_code_key" ON "Die"("shopId", "code");

-- CreateIndex
CREATE INDEX "ProductionJob_shopId_status_idx" ON "ProductionJob"("shopId", "status");

-- CreateIndex
CREATE INDEX "ProductionJob_machineId_status_idx" ON "ProductionJob"("machineId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJob_shopId_number_key" ON "ProductionJob"("shopId", "number");

-- CreateIndex
CREATE INDEX "ProductionRun_jobId_idx" ON "ProductionRun"("jobId");

-- CreateIndex
CREATE INDEX "ProductionRun_machineId_startedAt_idx" ON "ProductionRun"("machineId", "startedAt");

-- CreateIndex
CREATE INDEX "Shipment_shopId_idx" ON "Shipment"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shopId_number_key" ON "Shipment"("shopId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_shipmentId_key" ON "Invoice"("shipmentId");

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_dieId_fkey" FOREIGN KEY ("dieId") REFERENCES "Die"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_pressId_fkey" FOREIGN KEY ("pressId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_materialPartId_fkey" FOREIGN KEY ("materialPartId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Die" ADD CONSTRAINT "Die_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Die" ADD CONSTRAINT "Die_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Die" ADD CONSTRAINT "Die_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_dieId_fkey" FOREIGN KEY ("dieId") REFERENCES "Die"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_dieId_fkey" FOREIGN KEY ("dieId") REFERENCES "Die"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

