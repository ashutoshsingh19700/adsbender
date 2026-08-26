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

export interface AnalyticsQueryStore {
  getDailyMetrics(params: DailyMetricsParams): Promise<MetricsRow[]>;
}
