-- CreateTable
CREATE TABLE "ShopMember" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "ShopMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopMember_shopId_idx" ON "ShopMember"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopMember_userId_shopId_key" ON "ShopMember"("userId", "shopId");

-- AddForeignKey
ALTER TABLE "ShopMember" ADD CONSTRAINT "ShopMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopMember" ADD CONSTRAINT "ShopMember_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

