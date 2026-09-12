-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "PublisherSite" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "minAdvertiserBalanceUsd" DECIMAL(12,2) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "gstAmountUsd" DECIMAL(12,2);
