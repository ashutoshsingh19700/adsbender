-- CreateEnum
CREATE TYPE "CampaignConnectionType" AS ENUM ('WIFI', 'MOBILE_DATA', 'ALL');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "targetOperatingSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "connectionType" "CampaignConnectionType" NOT NULL DEFAULT 'ALL';
