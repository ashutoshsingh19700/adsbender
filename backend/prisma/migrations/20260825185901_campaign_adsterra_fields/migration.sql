-- CreateEnum
CREATE TYPE "CampaignAdFormat" AS ENUM ('POPUNDER', 'SOCIAL_BAR', 'NATIVE_BANNER', 'IN_PAGE_PUSH', 'INTERSTITIAL');

-- CreateEnum
CREATE TYPE "CampaignPricingModel" AS ENUM ('CPM', 'CPA', 'CPC');

-- CreateEnum
CREATE TYPE "CampaignStartMode" AS ENUM ('START_ONCE_VERIFIED', 'SCHEDULE', 'KEEP_INACTIVE');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "adFormat" "CampaignAdFormat",
ADD COLUMN     "budgetUnlimited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "countryPricing" JSONB,
ADD COLUMN     "locations" JSONB,
ADD COLUMN     "pricingModel" "CampaignPricingModel" NOT NULL DEFAULT 'CPM',
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "startMode" "CampaignStartMode" NOT NULL DEFAULT 'START_ONCE_VERIFIED';
