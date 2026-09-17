-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "accentColor" TEXT NOT NULL DEFAULT '#2f7cf6',
ADD COLUMN     "approvalMessage" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY['vehicles', 'customers', 'workOrders', 'schedule', 'estimates', 'invoices', 'parts', 'technicians', 'inspections', 'reports', 'payments', 'ai', 'messages', 'notifications']::TEXT[],
ADD COLUMN     "portalWelcome" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "InspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CannedService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "laborHours" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "laborRate" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CannedService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CannedServicePart" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "cannedServiceId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,

    CONSTRAINT "CannedServicePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "workOrderId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_customerId_createdAt_idx" ON "Message"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CannedServicePart" ADD CONSTRAINT "CannedServicePart_cannedServiceId_fkey" FOREIGN KEY ("cannedServiceId") REFERENCES "CannedService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CannedServicePart" ADD CONSTRAINT "CannedServicePart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
