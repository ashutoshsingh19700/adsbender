import { Inject, Injectable } from '@nestjs/common';

import type {
  AnalyticsQueryStore,
  DailyMetricsParams,
  GroupedMetricsParams,
  GroupedMetricsRow,
  MetricsRow,
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
