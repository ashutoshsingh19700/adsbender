-- AlterTable
ALTER TABLE "AdZone" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "AdZone_siteId_idx" ON "AdZone"("siteId");

-- AddForeignKey
ALTER TABLE "AdZone" ADD CONSTRAINT "AdZone_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PublisherSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
