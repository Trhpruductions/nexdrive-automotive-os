-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('WEBHOOK', 'MQTT', 'REST_POLL', 'CSV_FEED');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('RUNNING', 'IDLE', 'DOWN', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MachineEventType" AS ENUM ('STATUS', 'COUNT', 'READING', 'ALARM');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "keyHash" TEXT,
    "keyPrefix" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSeenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetPerHour" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastStatusChangeAt" TIMESTAMP(3),
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "integrationId" TEXT,
    "lineId" TEXT,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineEvent" (
    "id" TEXT NOT NULL,
    "type" "MachineEventType" NOT NULL,
    "status" "MachineStatus",
    "count" INTEGER,
    "good" INTEGER,
    "scrap" INTEGER,
    "metric" TEXT,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "code" TEXT,
    "message" TEXT,
    "raw" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "machineId" TEXT NOT NULL,

    CONSTRAINT "MachineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "error" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "integrationId" TEXT,

    CONSTRAINT "IngestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_keyHash_key" ON "Integration"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionLine_name_key" ON "ProductionLine"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");

-- CreateIndex
CREATE INDEX "Machine_lineId_idx" ON "Machine"("lineId");

-- CreateIndex
CREATE INDEX "MachineEvent_machineId_occurredAt_idx" ON "MachineEvent"("machineId", "occurredAt");

-- CreateIndex
CREATE INDEX "MachineEvent_occurredAt_idx" ON "MachineEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "IngestLog_createdAt_idx" ON "IngestLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineEvent" ADD CONSTRAINT "MachineEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestLog" ADD CONSTRAINT "IngestLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
