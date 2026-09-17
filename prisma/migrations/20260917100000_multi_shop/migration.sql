-- CreateEnum
CREATE TYPE "ShopPlan" AS ENUM ('TRIAL', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- DropIndex
DROP INDEX "Bay_name_key";

-- DropIndex
DROP INDEX "Invoice_number_key";

-- DropIndex
DROP INDEX "Machine_code_key";

-- DropIndex
DROP INDEX "Part_sku_key";

-- DropIndex
DROP INDEX "ProductionLine_name_key";

-- DropIndex
DROP INDEX "Supplier_name_key";

-- DropIndex
DROP INDEX "Vehicle_vin_key";

-- DropIndex
DROP INDEX "WorkOrder_number_key";

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "ShopPlan" NOT NULL DEFAULT 'TRIAL',
    "status" "ShopStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "ownerEmail" TEXT,
    "notes" TEXT,
    "woSeq" INTEGER NOT NULL DEFAULT 0,
    "invSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- Existing single-shop installs: everything already in the database belongs to one default shop.
INSERT INTO "Shop" ("id", "slug", "name", "plan", "status", "ownerEmail", "woSeq", "invSeq", "createdAt", "updatedAt")
SELECT 'shop_default', 'default', COALESCE((SELECT "name" FROM "ShopSettings" LIMIT 1), 'My Shop'), 'PRO', 'ACTIVE',
       (SELECT "email" FROM "User" WHERE "role" = 'OWNER' ORDER BY "createdAt" LIMIT 1),
       COALESCE((SELECT MAX("number") FROM "WorkOrder"), 0), COALESCE((SELECT MAX("number") FROM "Invoice"), 0), NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM "ShopSettings") OR EXISTS (SELECT 1 FROM "User");

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "shopId" TEXT;
UPDATE "ApiKey" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "ApiKey" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "shopId" TEXT;
UPDATE "Appointment" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Appointment" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "shopId" TEXT;
UPDATE "AuditLog" SET "shopId" = 'shop_default';

-- AlterTable
ALTER TABLE "Bay" ADD COLUMN     "shopId" TEXT;
UPDATE "Bay" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Bay" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CannedService" ADD COLUMN     "shopId" TEXT;
UPDATE "CannedService" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "CannedService" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "shopId" TEXT;
UPDATE "Customer" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "IngestLog" ADD COLUMN     "shopId" TEXT;
UPDATE "IngestLog" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "IngestLog" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "shopId" TEXT;
UPDATE "Inspection" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Inspection" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InspectionTemplateItem" ADD COLUMN     "shopId" TEXT;
UPDATE "InspectionTemplateItem" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "InspectionTemplateItem" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "shopId" TEXT;
UPDATE "Integration" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Integration" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "shopId" TEXT;
UPDATE "Invoice" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "shopId" SET NOT NULL,
ALTER COLUMN "number" DROP DEFAULT;
DROP SEQUENCE "Invoice_number_seq";

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "shopId" TEXT;
UPDATE "Machine" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Machine" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "shopId" TEXT;
UPDATE "Message" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Message" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "shopId" TEXT;
UPDATE "Notification" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Notification" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "shopId" TEXT;
UPDATE "Part" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Part" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductionLine" ADD COLUMN     "shopId" TEXT;
UPDATE "ProductionLine" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "ProductionLine" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ShopSettings" DROP CONSTRAINT "ShopSettings_pkey",
ADD COLUMN     "shopId" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DEFAULT 'My Shop';
UPDATE "ShopSettings" SET "shopId" = 'shop_default', "id" = 'settings_default';
ALTER TABLE "ShopSettings" ALTER COLUMN "shopId" SET NOT NULL,
ADD CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "shopId" TEXT;
UPDATE "Supplier" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Supplier" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Technician" ADD COLUMN     "shopId" TEXT;
UPDATE "Technician" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Technician" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shopId" TEXT;
UPDATE "User" SET "shopId" = 'shop_default';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "shopId" TEXT;
UPDATE "Vehicle" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN     "shopId" TEXT;
UPDATE "WebhookEndpoint" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "WebhookEndpoint" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "shopId" TEXT;
UPDATE "WorkOrder" SET "shopId" = 'shop_default' WHERE "shopId" IS NULL;
ALTER TABLE "WorkOrder" ALTER COLUMN "shopId" SET NOT NULL,
ALTER COLUMN "number" DROP DEFAULT;
DROP SEQUENCE "WorkOrder_number_seq";

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "shopName" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE INDEX "ApiKey_shopId_idx" ON "ApiKey"("shopId");

-- CreateIndex
CREATE INDEX "Appointment_shopId_idx" ON "Appointment"("shopId");

-- CreateIndex
CREATE INDEX "AuditLog_shopId_idx" ON "AuditLog"("shopId");

-- CreateIndex
CREATE INDEX "Bay_shopId_idx" ON "Bay"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Bay_shopId_name_key" ON "Bay"("shopId", "name");

-- CreateIndex
CREATE INDEX "CannedService_shopId_idx" ON "CannedService"("shopId");

-- CreateIndex
CREATE INDEX "Customer_shopId_idx" ON "Customer"("shopId");

-- CreateIndex
CREATE INDEX "IngestLog_shopId_idx" ON "IngestLog"("shopId");

-- CreateIndex
CREATE INDEX "Inspection_shopId_idx" ON "Inspection"("shopId");

-- CreateIndex
CREATE INDEX "InspectionTemplateItem_shopId_idx" ON "InspectionTemplateItem"("shopId");

-- CreateIndex
CREATE INDEX "Integration_shopId_idx" ON "Integration"("shopId");

-- CreateIndex
CREATE INDEX "Invoice_shopId_idx" ON "Invoice"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_shopId_number_key" ON "Invoice"("shopId", "number");

-- CreateIndex
CREATE INDEX "Machine_shopId_idx" ON "Machine"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_shopId_code_key" ON "Machine"("shopId", "code");

-- CreateIndex
CREATE INDEX "Message_shopId_idx" ON "Message"("shopId");

-- CreateIndex
CREATE INDEX "Notification_shopId_idx" ON "Notification"("shopId");

-- CreateIndex
CREATE INDEX "Part_shopId_idx" ON "Part"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_shopId_sku_key" ON "Part"("shopId", "sku");

-- CreateIndex
CREATE INDEX "ProductionLine_shopId_idx" ON "ProductionLine"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionLine_shopId_name_key" ON "ProductionLine"("shopId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shopId_key" ON "ShopSettings"("shopId");

-- CreateIndex
CREATE INDEX "Supplier_shopId_idx" ON "Supplier"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_shopId_name_key" ON "Supplier"("shopId", "name");

-- CreateIndex
CREATE INDEX "Technician_shopId_idx" ON "Technician"("shopId");

-- CreateIndex
CREATE INDEX "User_shopId_idx" ON "User"("shopId");

-- CreateIndex
CREATE INDEX "Vehicle_shopId_idx" ON "Vehicle"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_shopId_vin_key" ON "Vehicle"("shopId", "vin");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_shopId_idx" ON "WebhookEndpoint"("shopId");

-- CreateIndex
CREATE INDEX "WorkOrder_shopId_idx" ON "WorkOrder"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_shopId_number_key" ON "WorkOrder"("shopId", "number");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bay" ADD CONSTRAINT "Bay_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CannedService" ADD CONSTRAINT "CannedService_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLine" ADD CONSTRAINT "ProductionLine_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestLog" ADD CONSTRAINT "IngestLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
