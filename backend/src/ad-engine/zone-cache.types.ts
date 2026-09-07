// Zones only ever need a yes/no "is this zone currently servable" answer
// (see AdTargetingService.selectCampaign) - unlike campaigns, nothing about
// a zone's own fields (name, dimensions, layout) is ever read on the
// /serve hot path, so the cache only needs to track ACTIVE zone ids, not a
// full record per zone.
export interface ZoneCacheStore {
  replaceActiveZoneIds(zoneIds: string[]): Promise<void>;
  isActiveZone(zoneId: string): Promise<boolean>;
}
