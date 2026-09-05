import { Injectable } from '@nestjs/common';

import type {
  AnalyticsEventStore,
  ClickEvent,
  ImpressionEvent,
  TrafficEvent,
} from './ad-event.types';

type ClickHouseOptions = {
  url: string;
  database: string;
  username: string;
  password?: string;
};

@Injectable()
export class ClickHouseAnalyticsEventStore implements AnalyticsEventStore {
  private readonly options: ClickHouseOptions = {
    url: process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123',
    database: process.env.CLICKHOUSE_DB ?? 'analytics',
    username: process.env.CLICKHOUSE_USER ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD,
  };

  async ensureSchema() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.options.database}.impressions
      (
        event_time DateTime,
        zone_id String,
        campaign_id String,
        advertiser_id String,
        cost Float64,
        origin String,
        path String,
        country Nullable(String),
        device String,
        ip_address String,
        user_agent String
      )
      ENGINE = MergeTree
      ORDER BY (event_time, campaign_id, zone_id)
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.options.database}.clicks
      (
        event_time DateTime,
        zone_id String,
        campaign_id String,
        advertiser_id String,
        cost Float64,
        origin String,
        path String,
        country Nullable(String),
        device String,
        ip_address String,
        user_agent String
      )
      ENGINE = MergeTree
      ORDER BY (event_time, campaign_id, zone_id)
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.options.database}.traffic_events
      (
        event_time DateTime,
        stage String,
        outcome String,
        reason String,
        zone_id String,
        campaign_id Nullable(String),
        advertiser_id Nullable(String),
        origin String,
        path String,
        country Nullable(String),
        device String,
        ip_address String,
        user_agent String
      )
      ENGINE = MergeTree
      ORDER BY (event_time, zone_id, reason)
    `);
  }

  async insertImpressions(events: ImpressionEvent[]) {
    if (events.length === 0) {
      return;
    }

    const rows = events
      .map((event) =>
        JSON.stringify({
          event_time: this.formatDateTime(event.time),
          zone_id: event.zone,
          campaign_id: event.campaign,
          advertiser_id: event.advertiser,
          cost: event.cost,
          origin: event.request.origin,
          path: event.request.path,
          country: event.request.country,
          device: event.request.device,
          ip_address: event.request.ipAddress,
          user_agent: event.request.userAgent,
        }),
      )
      .join('\n');

    await this.query(
      `INSERT INTO ${this.options.database}.impressions FORMAT JSONEachRow`,
      rows,
    );
  }

  async insertClicks(events: ClickEvent[]) {
    if (events.length === 0) {
      return;
    }

    const rows = events
      .map((event) =>
        JSON.stringify({
          event_time: this.formatDateTime(event.time),
          zone_id: event.zone,
          campaign_id: event.campaign,
          advertiser_id: event.advertiser,
          cost: event.cost,
          origin: event.request.origin,
          path: event.request.path,
          country: event.request.country,
          device: event.request.device,
          ip_address: event.request.ipAddress,
          user_agent: event.request.userAgent,
        }),
      )
      .join('\n');

    await this.query(
      `INSERT INTO ${this.options.database}.clicks FORMAT JSONEachRow`,
      rows,
    );
  }

  async insertTrafficEvents(events: TrafficEvent[]) {
    if (events.length === 0) {
      return;
    }

    const rows = events
      .map((event) =>
        JSON.stringify({
          event_time: this.formatDateTime(event.time),
          stage: event.stage,
          outcome: event.outcome,
          reason: event.reason,
          zone_id: event.zone,
          campaign_id: event.campaign ?? null,
          advertiser_id: event.advertiser ?? null,
          origin: event.request.origin,
          path: event.request.path,
          country: event.request.country,
          device: event.request.device,
          ip_address: event.request.ipAddress,
          user_agent: event.request.userAgent,
        }),
      )
      .join('\n');

    await this.query(
      `INSERT INTO ${this.options.database}.traffic_events FORMAT JSONEachRow`,
      rows,
    );
  }

  private async query(sql: string, body = '') {
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
      body,
    });

    if (!response.ok) {
      throw new Error(`ClickHouse query failed: ${response.status}`);
    }
  }

  private formatDateTime(epochSeconds: number) {
    return new Date(epochSeconds * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
  }
}
