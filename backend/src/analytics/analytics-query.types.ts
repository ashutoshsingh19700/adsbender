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
export type GroupDimension = 'date' | 'domain' | 'placement' | 'country' | 'device';

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
  // Restricts the query to this publisher's own ad zones. Required (and may
  // be empty, which short-circuits to no rows) so one publisher can never
  // see another's numbers.
  zoneIds: string[];
  groupBy: GroupDimension;
  country?: string;
  domain?: string;
  platformFeeBps: number;
};

export interface AnalyticsQueryStore {
  getDailyMetrics(params: DailyMetricsParams): Promise<MetricsRow[]>;
  getGroupedMetrics(params: GroupedMetricsParams): Promise<GroupedMetricsRow[]>;
}
