-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shop_stripeCustomerId_key" ON "Shop"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_stripeSubscriptionId_key" ON "Shop"("stripeSubscriptionId");

