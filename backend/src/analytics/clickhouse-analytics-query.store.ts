import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  AnalyticsQueryStore,
  DailyMetricsParams,
  MetricsRow,
} from './analytics-query.types';

// Every id in this app is a Prisma-generated UUID. We build ClickHouse SQL
// by string interpolation (no query-parameter support in the raw HTTP
// client below), so this check is what stops someone from injecting SQL
// through a campaignId/zoneId query param.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertSafeId(id: string, label: string) {
  if (!UUID_PATTERN.test(id)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
}

@Injectable()
export class ClickHouseAnalyticsQueryStore implements AnalyticsQueryStore {
  private readonly options = {
    url: process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123',
    database: process.env.CLICKHOUSE_DB ?? 'analytics',
    username: process.env.CLICKHOUSE_USER ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD,
  };

  async getDailyMetrics(params: DailyMetricsParams): Promise<MetricsRow[]> {
    if (params.campaignId) {
      assertSafeId(params.campaignId, 'campaignId');
    }
    if (params.zoneId) {
      assertSafeId(params.zoneId, 'zoneId');
    }

    // Extra WHERE conditions, applied to both the impressions and clicks
    // sub-queries below so a filtered request only counts its own rows.
    const extraFilter = [
      params.campaignId ? `AND campaign_id = '${params.campaignId}'` : '',
      params.zoneId ? `AND zone_id = '${params.zoneId}'` : '',
    ].join(' ');

    const sql = `
      SELECT
        date,
        impressions,
        clicks,
        round(if(impressions > 0, (clicks / impressions) * 100, 0), 4) AS ctr,
        spend,
        round(spend * 0.7, 4) AS payout
      FROM
      (
        SELECT
          ifNull(daily_impressions.date, daily_clicks.date) AS date,
          ifNull(daily_impressions.impressions, 0) AS impressions,
          ifNull(daily_clicks.clicks, 0) AS clicks,
          ifNull(daily_impressions.spend, 0) AS spend
        FROM
        (
          SELECT
            toDate(event_time) AS date,
            count() AS impressions,
            round(sum(cost), 4) AS spend
          FROM ${this.options.database}.impressions
          WHERE event_time >= parseDateTimeBestEffort('${params.startDate}')
            AND event_time < parseDateTimeBestEffort('${params.endDate}') + INTERVAL 1 DAY
            ${extraFilter}
          GROUP BY date
        ) AS daily_impressions
        FULL OUTER JOIN
        (
          SELECT
            toDate(event_time) AS date,
            count() AS clicks
          FROM ${this.options.database}.clicks
          WHERE event_time >= parseDateTimeBestEffort('${params.startDate}')
            AND event_time < parseDateTimeBestEffort('${params.endDate}') + INTERVAL 1 DAY
            ${extraFilter}
          GROUP BY date
        ) AS daily_clicks
        ON daily_impressions.date = daily_clicks.date
      )
      ORDER BY date ASC
      FORMAT JSONEachRow
    `;
    const response = await this.query(sql);

    return response
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const row = JSON.parse(line) as MetricsRow;

        return {
          date: row.date,
          impressions: Number(row.impressions),
          clicks: Number(row.clicks),
          ctr: Number(row.ctr),
          spend: Number(row.spend),
          payout: Number(row.payout),
        };
      });
  }

  private async query(sql: string) {
    const url = new URL('/', this.options.url);
    url.searchParams.set('query', sql);

    const headers: Record<string, string> = {};

    if (this.options.username) {
      headers.Authorization = `Basic ${Buffer.from(
        `${this.options.username}:${this.options.password ?? ''}`,
      ).toString('base64')}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      throw new Error(`ClickHouse analytics query failed: ${response.status}`);
    }

    return response.text();
  }
}
