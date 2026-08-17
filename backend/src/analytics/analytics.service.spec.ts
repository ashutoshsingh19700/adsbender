import { Test, TestingModule } from '@nestjs/testing';

import { ANALYTICS_QUERY_STORE, AnalyticsService } from './analytics.service';
import type { AnalyticsQueryStore } from './analytics-query.types';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let store: jest.Mocked<AnalyticsQueryStore>;

  beforeEach(async () => {
    store = {
      getDailyMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: ANALYTICS_QUERY_STORE,
          useValue: store,
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  it('returns daily rows and aggregate dashboard totals with CTR calculation', async () => {
    store.getDailyMetrics.mockResolvedValue([
      {
        date: '2026-07-20',
        impressions: 100,
        clicks: 4,
        ctr: 4,
        spend: 10,
        payout: 7,
      },
      {
        date: '2026-07-21',
        impressions: 50,
        clicks: 2,
        ctr: 4,
        spend: 5,
        payout: 3.5,
      },
    ]);

    await expect(
      service.getDailyMetrics('2026-07-20', '2026-07-21'),
    ).resolves.toEqual({
      rows: expect.any(Array),
      totals: {
        impressions: 150,
        clicks: 6,
        ctr: 4,
        spend: 15,
        payout: 10.5,
      },
    });
  });
});
