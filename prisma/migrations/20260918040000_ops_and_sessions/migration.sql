-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "count" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_name_startedAt_idx" ON "JobRun"("name", "startedAt");

-- CreateIndex
CREATE INDEX "Appointment_status_reminderSentAt_scheduledStart_idx" ON "Appointment"("status", "reminderSentAt", "scheduledStart");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_completed_notifiedAt_idx" ON "MaintenanceReminder"("completed", "notifiedAt");

-- CreateIndex
CREATE INDEX "Notification_status_channel_createdAt_idx" ON "Notification"("status", "channel", "createdAt");

