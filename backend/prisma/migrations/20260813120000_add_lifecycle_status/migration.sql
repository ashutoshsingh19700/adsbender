-- New enums for ad-zone and publisher-site lifecycle state
CREATE TYPE "AdZoneStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Campaigns can now be archived (terminal state) instead of only completed
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- Lifecycle status columns (default keeps existing rows working as-is)
ALTER TABLE "AdZone" ADD COLUMN "status" "AdZoneStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "PublisherSite" ADD COLUMN "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE';

-- Campaign notes field was accepted by the create DTO but never saved - fixing that
ALTER TABLE "Campaign" ADD COLUMN "notes" TEXT;

CREATE INDEX "AdZone_status_idx" ON "AdZone"("status");
CREATE INDEX "PublisherSite_status_idx" ON "PublisherSite"("status");
