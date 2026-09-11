// Zones need their `layoutType` on the /serve hot path now too (see
// AdTargetingService.selectCampaign format-matching and
// AdEngineController's renderFamily lookup) - no longer just a yes/no
// "is this zone active" answer.
export type CacheableZone = {
  id: string;
  layoutType: string;
};

export type ZoneCacheRecord = {
  layoutType: string;
};

export interface ZoneCacheStore {
  replaceActiveZoneIds(zones: CacheableZone[]): Promise<void>;
  // Returns null when the zone isn't active/known - same "not found" path a
  // paused zone, a deleted zone, or a malformed/client-suppliable zoneId
  // that was never real all fall into.
  getActiveZone(zoneId: string): Promise<ZoneCacheRecord | null>;
}
