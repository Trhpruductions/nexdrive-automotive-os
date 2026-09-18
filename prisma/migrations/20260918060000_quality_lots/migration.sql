-- CreateEnum
CREATE TYPE "QcKind" AS ENUM ('FIRST_PIECE', 'IN_PROCESS', 'FINAL');

-- CreateEnum
CREATE TYPE "QcResult" AS ENUM ('PASS', 'FAIL');

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "checkEveryPieces" INTEGER,
ADD COLUMN     "checkPlan" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "drawingRev" TEXT;

-- AlterTable
ALTER TABLE "ProductionJob" ADD COLUMN     "firstPieceAt" TIMESTAMP(3),
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "lotId" TEXT,
ADD COLUMN     "onHold" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductionRun" ADD COLUMN     "lotId" TEXT;

-- CreateTable
CREATE TABLE "QualityCheck" (
    "id" TEXT NOT NULL,
    "kind" "QcKind" NOT NULL,
    "result" "QcResult" NOT NULL,
    "pieceCount" INTEGER NOT NULL DEFAULT 0,
    "measurements" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "inspector" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" TEXT NOT NULL,
    "runId" TEXT,
    "dieId" TEXT,
    "lotId" TEXT,
    "userId" TEXT,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "QualityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapEntry" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" TEXT NOT NULL,
    "runId" TEXT,
    "dieId" TEXT,
    "lotId" TEXT,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "ScrapEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "heatNumber" TEXT,
    "supplier" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "remaining" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'lb',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certOnFile" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "MaterialLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualityCheck_shopId_checkedAt_idx" ON "QualityCheck"("shopId", "checkedAt");

-- CreateIndex
CREATE INDEX "QualityCheck_jobId_idx" ON "QualityCheck"("jobId");

-- CreateIndex
CREATE INDEX "ScrapEntry_shopId_at_idx" ON "ScrapEntry"("shopId", "at");

-- CreateIndex
CREATE INDEX "ScrapEntry_jobId_idx" ON "ScrapEntry"("jobId");

-- CreateIndex
CREATE INDEX "MaterialLot_shopId_partId_idx" ON "MaterialLot"("shopId", "partId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLot_shopId_partId_lotNumber_key" ON "MaterialLot"("shopId", "partId", "lotNumber");

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "MaterialLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "MaterialLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_dieId_fkey" FOREIGN KEY ("dieId") REFERENCES "Die"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "MaterialLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_dieId_fkey" FOREIGN KEY ("dieId") REFERENCES "Die"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "MaterialLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

