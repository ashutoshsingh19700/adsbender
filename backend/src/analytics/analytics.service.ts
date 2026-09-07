import { Inject, Injectable } from '@nestjs/common';

import type {
  AnalyticsQueryStore,
  DailyMetricsParams,
  GroupedMetricsParams,
  GroupedMetricsRow,
  MetricsRow,
  TrafficQualityParams,
} from './analytics-query.types';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export const ANALYTICS_QUERY_STORE = Symbol('ANALYTICS_QUERY_STORE');

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_QUERY_STORE)
    private readonly analyticsQueryStore: AnalyticsQueryStore,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async getDailyMetrics(
    startDate: string,
    endDate: string,
    filter?: Pick<DailyMetricsParams, 'campaignId' | 'zoneId'>,
  ) {
    const platformFeeBps = await this.platformSettingsService.getPlatformFeeBps();
    const rows = await this.analyticsQueryStore.getDailyMetrics({
      startDate,
      endDate,
      platformFeeBps,
      ...filter,
    });

    return {
      rows,
      totals: this.calculateTotals(rows),
    };
  }

  async getGroupedMetrics(
    params: Omit<GroupedMetricsParams, 'platformFeeBps'>,
  ) {
    const platformFeeBps = await this.platformSettingsService.getPlatformFeeBps();
    const rows = await this.analyticsQueryStore.getGroupedMetrics({
      ...params,
      platformFeeBps,
    });

    return {
      rows,
      totals: this.calculateTotals(rows),
    };
  }

  // Powers the "Traffic Quality" / fraud-protection panel on the admin,
  // publisher, and advertiser dashboards - see PublisherService and
  // AdvertiserService for the zone/campaign-scoped wrappers around this, and
  // AdminService for the unscoped (platform-wide) call. Shaped for a UI to
  // render directly: a reason breakdown (for a bar chart / table) and a
  // by-date trend (for a line chart), plus a blocked/flagged total either
  // can headline with.
  async getTrafficQuality(params: TrafficQualityParams) {
    const rows = await this.analyticsQueryStore.getTrafficQuality(params);

    const totalBlocked = rows
      .filter((row) => row.outcome === 'blocked')
      .reduce((sum, row) => sum + row.count, 0);
    const totalFlagged = rows
      .filter((row) => row.outcome === 'flagged')
      .reduce((sum, row) => sum + row.count, 0);

    const byReasonMap = new Map<
      string,
      { reason: string; stage: string; blocked: number; flagged: number }
    >();
    for (const row of rows) {
      const key = `${row.stage}:${row.reason}`;
      const existing = byReasonMap.get(key) ?? {
        reason: row.reason,
        stage: row.stage,
        blocked: 0,
        flagged: 0,
      };
      existing[row.outcome] += row.count;
      byReasonMap.set(key, existing);
    }

    const byDateMap = new Map<string, { date: string; blocked: number; flagged: number }>();
    for (const row of rows) {
      const existing = byDateMap.get(row.date) ?? {
        date: row.date,
        blocked: 0,
        flagged: 0,
      };
      existing[row.outcome] += row.count;
      byDateMap.set(row.date, existing);
    }

    return {
      totalBlocked,
      totalFlagged,
      byReason: Array.from(byReasonMap.values()).sort(
        (a, b) => b.blocked + b.flagged - (a.blocked + a.flagged),
      ),
      byDate: Array.from(byDateMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    };
  }

  private calculateTotals(rows: MetricsRow[] | GroupedMetricsRow[]) {
    const totals = rows.reduce(
      (acc, row) => ({
        impressions: acc.impressions + row.impressions,
        clicks: acc.clicks + row.clicks,
        spend: acc.spend + row.spend,
        payout: acc.payout + row.payout,
      }),
      {
        impressions: 0,
        clicks: 0,
        spend: 0,
        payout: 0,
      },
    );

    return {
      ...totals,
      ctr:
        totals.impressions === 0
          ? 0
          : Number(((totals.clicks / totals.impressions) * 100).toFixed(2)),
      spend: Number(totals.spend.toFixed(4)),
      payout: Number(totals.payout.toFixed(4)),
    };
  }
}
