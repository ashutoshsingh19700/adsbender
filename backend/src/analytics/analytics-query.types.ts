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
};

export interface AnalyticsQueryStore {
  getDailyMetrics(params: DailyMetricsParams): Promise<MetricsRow[]>;
}
