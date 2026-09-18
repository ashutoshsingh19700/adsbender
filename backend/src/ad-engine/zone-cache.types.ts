// Zones need their `layoutType` on the /serve hot path now too (see
// AdTargetingService.selectCampaign format-matching and
// AdEngineController's renderFamily lookup) - no longer just a yes/no
// "is this zone active" answer. publisherId/siteId ride along the same
// cache entry so AdEngineController can scope publisher-side impression
// dedup (see PublisherImpressionDedupService) without a per-request
// Postgres lookup - siteId is nullable the same way AdZone.siteId is (a
// zone created before sites existed, or outside the "Add ad unit" flow).
export type CacheableZone = {
  id: string;
  layoutType: string;
  publisherId: string;
  siteId: string | null;
  // Restricts serving to campaigns whose category is in this list - see
  // AdZone.allowedCategories in schema.prisma and
  // AdTargetingService.isEligible. Empty means no restriction.
  allowedCategories: string[];
};

export type ZoneCacheRecord = {
  layoutType: string;
  publisherId: string;
  siteId: string | null;
  allowedCategories: string[];
};

export interface ZoneCacheStore {
  replaceActiveZoneIds(zones: CacheableZone[]): Promise<void>;
  // Returns null when the zone isn't active/known - same "not found" path a
  // paused zone, a deleted zone, or a malformed/client-suppliable zoneId
  // that was never real all fall into.
  getActiveZone(zoneId: string): Promise<ZoneCacheRecord | null>;
}
