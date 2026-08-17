import { ClickHouseAnalyticsEventStore } from './clickhouse-analytics-event.store';

describe('ClickHouseAnalyticsEventStore', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let store: ClickHouseAnalyticsEventStore;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);
    process.env.CLICKHOUSE_URL = 'http://clickhouse.test:8123';
    process.env.CLICKHOUSE_DB = 'analytics';
    process.env.CLICKHOUSE_USER = 'default';
    process.env.CLICKHOUSE_PASSWORD = '';
    store = new ClickHouseAnalyticsEventStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CLICKHOUSE_URL;
    delete process.env.CLICKHOUSE_DB;
    delete process.env.CLICKHOUSE_USER;
    delete process.env.CLICKHOUSE_PASSWORD;
  });

  it('creates the impressions and clicks tables when the worker starts', async () => {
    await store.ensureSchema();

    const firstQuery = new URL(
      fetchSpy.mock.calls[0][0] as string,
    ).searchParams.get('query');
    const secondQuery = new URL(
      fetchSpy.mock.calls[1][0] as string,
    ).searchParams.get('query');

    expect(firstQuery).toContain(
      'CREATE TABLE IF NOT EXISTS analytics.impressions',
    );
    expect(secondQuery).toContain(
      'CREATE TABLE IF NOT EXISTS analytics.clicks',
    );
  });

  it('bulk inserts impression events using JSONEachRow', async () => {
    await store.insertImpressions([
      {
        type: 'impression',
        zone: '42',
        campaign: 'campaign-1',
        advertiser: 'advertiser-1',
        cost: 0.001,
        time: 1719274200,
        request: {
          origin: 'https://publisher.test',
          path: '/article',
          country: 'US',
          device: 'mobile',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 Mobile',
        },
      },
    ]);

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    const body = fetchSpy.mock.calls[0][1]?.body as string;

    expect(url.searchParams.get('query')).toBe(
      'INSERT INTO analytics.impressions FORMAT JSONEachRow',
    );
    expect(JSON.parse(body)).toEqual({
      event_time: '2024-06-25 00:10:00',
      zone_id: '42',
      campaign_id: 'campaign-1',
      advertiser_id: 'advertiser-1',
      cost: 0.001,
      origin: 'https://publisher.test',
      path: '/article',
      country: 'US',
      device: 'mobile',
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Mobile',
    });
  });

  it('bulk inserts click events using JSONEachRow', async () => {
    await store.insertClicks([
      {
        type: 'click',
        zone: '42',
        campaign: 'campaign-1',
        advertiser: 'advertiser-1',
        cost: 0.001,
        time: 1719274200,
        request: {
          origin: 'https://publisher.test',
          path: '/article',
          country: 'US',
          device: 'mobile',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 Mobile',
        },
      },
    ]);

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    const body = fetchSpy.mock.calls[0][1]?.body as string;

    expect(url.searchParams.get('query')).toBe(
      'INSERT INTO analytics.clicks FORMAT JSONEachRow',
    );
    expect(JSON.parse(body)).toEqual({
      event_time: '2024-06-25 00:10:00',
      zone_id: '42',
      campaign_id: 'campaign-1',
      advertiser_id: 'advertiser-1',
      cost: 0.001,
      origin: 'https://publisher.test',
      path: '/article',
      country: 'US',
      device: 'mobile',
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Mobile',
    });
  });
});
