-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'SERVICE_ADVISOR', 'TECHNICIAN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('GENERAL', 'DAMAGE', 'INSPECTION', 'BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('ESTIMATE', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LineKind" AS ENUM ('LABOR', 'PART', 'FEE', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('GOOD', 'ATTENTION', 'URGENT', 'NA');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'CHECK', 'ACH', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PORTAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AiRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TECHNICIAN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "specialty" TEXT,
    "hourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bay" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Bay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "notes" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vin" TEXT,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "color" TEXT,
    "licensePlate" TEXT,
    "plateState" TEXT,
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "engine" TEXT,
    "transmission" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "kind" "PhotoKind" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT NOT NULL,
    "workOrderId" TEXT,

    CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceReminder" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "dueAtMileage" INTEGER,
    "dueAtDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT NOT NULL,

    CONSTRAINT "MaintenanceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "serviceRequested" TEXT NOT NULL,
    "notes" TEXT,
    "dropOff" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "technicianId" TEXT,
    "bayId" TEXT,
    "workOrderId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'ESTIMATE',
    "complaint" TEXT NOT NULL,
    "diagnosis" TEXT,
    "technicianNotes" TEXT,
    "internalNotes" TEXT,
    "mileageIn" INTEGER,
    "mileageOut" INTEGER,
    "promisedAt" TIMESTAMP(3),
    "approvalToken" TEXT,
    "sentForApprovalAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "declinedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "technicianId" TEXT,
    "bayId" TEXT,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderLine" (
    "id" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hours" DECIMAL(6,2),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT,

    CONSTRAINT "WorkOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "workOrderId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "technicianId" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "result" "InspectionResult" NOT NULL DEFAULT 'NA',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "inspectionId" TEXT NOT NULL,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "location" TEXT,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partId" TEXT NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'PORTAL',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "workOrderId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Plex Roswell Automotive',
    "tagline" TEXT NOT NULL DEFAULT 'Automotive Service Center',
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0.0700,
    "laborRate" DECIMAL(10,2) NOT NULL DEFAULT 125.00,
    "shopFeeRate" DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    "openTime" TEXT NOT NULL DEFAULT '08:00',
    "closeTime" TEXT NOT NULL DEFAULT '18:00',
    "invoiceFooter" TEXT,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "role" "AiRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Technician_userId_key" ON "Technician"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bay_name_key" ON "Bay"("name");

-- CreateIndex
CREATE INDEX "Customer_lastName_firstName_idx" ON "Customer"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_customerId_idx" ON "Vehicle"("customerId");

-- CreateIndex
CREATE INDEX "Vehicle_licensePlate_idx" ON "Vehicle"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_workOrderId_key" ON "Appointment"("workOrderId");

-- CreateIndex
CREATE INDEX "Appointment_scheduledStart_idx" ON "Appointment"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_number_key" ON "WorkOrder"("number");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_approvalToken_key" ON "WorkOrder"("approvalToken");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");

-- CreateIndex
CREATE INDEX "WorkOrder_vehicleId_idx" ON "WorkOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkOrderLine_workOrderId_idx" ON "WorkOrderLine"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_workOrderId_key" ON "Inspection"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");

-- CreateIndex
CREATE INDEX "Part_category_idx" ON "Part"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_workOrderId_key" ON "Invoice"("workOrderId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

-- CreateIndex
CREATE INDEX "Notification_customerId_createdAt_idx" ON "Notification"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiMessage_userId_createdAt_idx" ON "AiMessage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceReminder" ADD CONSTRAINT "MaintenanceReminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "Bay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "Bay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLine" ADD CONSTRAINT "WorkOrderLine_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLine" ADD CONSTRAINT "WorkOrderLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
