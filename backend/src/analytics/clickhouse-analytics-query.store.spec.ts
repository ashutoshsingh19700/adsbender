import { ClickHouseAnalyticsQueryStore } from './clickhouse-analytics-query.store';

describe('ClickHouseAnalyticsQueryStore', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let store: ClickHouseAnalyticsQueryStore;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        [
          JSON.stringify({
            date: '2026-07-20',
            impressions: 100,
            clicks: 0,
            ctr: 0,
            spend: 1.25,
            payout: 0.875,
          }),
        ].join('\n'),
      ),
    } as any);
    process.env.CLICKHOUSE_URL = 'http://clickhouse.test:8123';
    process.env.CLICKHOUSE_DB = 'analytics';
    store = new ClickHouseAnalyticsQueryStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CLICKHOUSE_URL;
    delete process.env.CLICKHOUSE_DB;
  });

  it('queries ClickHouse daily impression metrics using JSONEachRow output', async () => {
    await expect(
      store.getDailyMetrics({
        startDate: '2026-07-20',
        endDate: '2026-07-21',
      }),
    ).resolves.toEqual([
      {
        date: '2026-07-20',
        impressions: 100,
        clicks: 0,
        ctr: 0,
        spend: 1.25,
        payout: 0.875,
      },
    ]);

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    const query = url.searchParams.get('query') ?? '';

    expect(query).toContain('FROM analytics.impressions');
    expect(query).toContain('FROM analytics.clicks');
    expect(query).toContain('GROUP BY date');
    expect(query).toContain('FORMAT JSONEachRow');
  });

  it('adds a campaign_id filter to the query when campaignId is given', async () => {
    const campaignId = '11111111-1111-1111-1111-111111111111';

    await store.getDailyMetrics({
      startDate: '2026-07-20',
      endDate: '2026-07-21',
      campaignId,
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    const query = url.searchParams.get('query') ?? '';

    expect(query).toContain(`campaign_id = '${campaignId}'`);
  });

  it('rejects a non-UUID campaignId instead of building unsafe SQL', async () => {
    await expect(
      store.getDailyMetrics({
        startDate: '2026-07-20',
        endDate: '2026-07-21',
        campaignId: "x'; DROP TABLE analytics.impressions; --",
      }),
    ).rejects.toThrow('Invalid campaignId');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('computes a real CTR from joined impression and click counts', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          date: '2026-07-20',
          impressions: 200,
          clicks: 10,
          ctr: 5,
          spend: 2.5,
          payout: 1.75,
        }),
      ),
    } as any);

    await expect(
      store.getDailyMetrics({
        startDate: '2026-07-20',
        endDate: '2026-07-21',
      }),
    ).resolves.toEqual([
      {
        date: '2026-07-20',
        impressions: 200,
        clicks: 10,
        ctr: 5,
        spend: 2.5,
        payout: 1.75,
      },
    ]);
  });
});
