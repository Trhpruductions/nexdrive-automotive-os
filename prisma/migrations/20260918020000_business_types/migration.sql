-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "terms" JSONB,
ADD COLUMN     "vertical" TEXT NOT NULL DEFAULT 'automotive';

