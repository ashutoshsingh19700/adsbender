// Same shape as ZoneCacheStore (see zone-cache.types.ts) and same
// reasoning: FraudDetectionService only ever needs a yes/no "is this IP
// blacklisted" answer on the /serve and /click hot path, never the full
// BlacklistedIp row (source/reason/timestamps), so the cache only tracks
// the IP set.
export interface BlacklistCacheStore {
  replaceBlacklistedIps(ipAddresses: string[]): Promise<void>;
  isBlacklisted(ipAddress: string): Promise<boolean>;
}
