-- CreateEnum
CREATE TYPE "SiteVerificationMethod" AS ENUM ('ADS_TXT', 'AD_SNIPPET');

-- AlterTable
ALTER TABLE "PublisherSite" ADD COLUMN     "verificationMethod" "SiteVerificationMethod" NOT NULL DEFAULT 'ADS_TXT',
ALTER COLUMN "adsTxtUrl" DROP NOT NULL,
ALTER COLUMN "expectedText" DROP NOT NULL;
