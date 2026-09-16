export type MetricsRow = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  payout: number;
};

export type DailyMetricsParams = {
  startDate: string;
  endDate: string;
  // Optional filters so one advertiser/publisher can see only their own
  // campaign or zone instead of the whole platform's numbers.
  campaignId?: string;
  zoneId?: string;
  // Current platform fee (basis points) - see PlatformSettingsService.
  // Applied uniformly to every row in the query's date range, so the
  // resulting `payout` is an approximation for historical rows priced under
  // a different rate (ClickHouse doesn't store the rate active at the time
  // each event billed) - the exact per-transaction figure lives in the
  // Postgres wallet ledger (see AdminService.getRevenueSummary).
  platformFeeBps: number;
};

// Dimensions the publisher-facing Statistics screen can group rows by. Each
// maps to a column that's already captured on every impression/click event
// (see ClickHouseAnalyticsEventStore.ensureSchema) - there's no "browser" or
// "operating system" dimension because the raw user_agent string is stored
// but never parsed into either, so those aren't offered as group-by options.
export type GroupDimension =
  | 'date'
  | 'domain'
  | 'placement'
  | 'country'
  | 'device'
  | 'campaign';

export type GroupedMetricsRow = {
  // Raw group value - a YYYY-MM-DD date, the request `origin` (domain), a
  // zone_id (placement), a country code, or a device type, depending on
  // `groupBy`. Callers that need a friendlier label (e.g. zone name instead
  // of zone_id for "placement") resolve it themselves - the query store has
  // no knowledge of Postgres-side names.
  key: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  payout: number;
};

export type GroupedMetricsParams = {
  startDate: string;
  endDate: string;
  // Scope filters - same "defined-but-empty means zero rows, never falls
  // back to unscoped" rule as TrafficQualityParams below. PublisherService
  // (and AdminService's per-publisher drill-down) pass zoneIds; AdvertiserService
  // (and AdminService's per-advertiser drill-down) pass campaignIds instead.
  // At least one of the two must be provided - callers own their own
  // tenant's ids so one publisher/advertiser can never see another's numbers.
  zoneIds?: string[];
  campaignIds?: string[];
  groupBy: GroupDimension;
  country?: string;
  domain?: string;
  platformFeeBps: number;
};

// One row of the traffic-quality breakdown: how many blocked/flagged
// impression or click attempts FraudDetectionService recorded for a given
// reason (IP_BLACKLISTED, SUSPICIOUS_USER_AGENT, DATACENTER_IP_CLICK,
// MISSING_CLICK_TOKEN, CLICK_TOKEN_EXPIRED, ...) - see TrafficEvent in
// ad-engine/ad-event.types.ts, the only source of these rows.
export type TrafficQualityRow = {
  date: string;
  stage: 'impression' | 'click';
  outcome: 'blocked' | 'flagged';
  reason: string;
  count: number;
};

export type TrafficQualityParams = {
  startDate: string;
  endDate: string;
  // Scope filters - mirrors the zoneId/campaignId scoping on
  // DailyMetricsParams/GroupedMetricsParams above. Admin passes neither
  // (platform-wide); PublisherService passes zoneIds; AdvertiserService
  // passes campaignIds. Both empty means "no scope restriction" for admin,
  // NOT "zero rows" - unlike GroupedMetricsParams.zoneIds, these are
  // optional rather than required, so an admin call can omit them entirely.
  zoneIds?: string[];
  campaignIds?: string[];
};

export interface AnalyticsQueryStore {
  getDailyMetrics(params: DailyMetricsParams): Promise<MetricsRow[]>;
  getGroupedMetrics(params: GroupedMetricsParams): Promise<GroupedMetricsRow[]>;
  getTrafficQuality(params: TrafficQualityParams): Promise<TrafficQualityRow[]>;
}
