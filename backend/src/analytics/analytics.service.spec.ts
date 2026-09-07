import { Test, TestingModule } from '@nestjs/testing';

import { ANALYTICS_QUERY_STORE, AnalyticsService } from './analytics.service';
import type { AnalyticsQueryStore } from './analytics-query.types';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let store: jest.Mocked<AnalyticsQueryStore>;
  let platformSettingsService: { getPlatformFeeBps: jest.Mock };

  beforeEach(async () => {
    store = {
      getDailyMetrics: jest.fn(),
      getGroupedMetrics: jest.fn(),
      getTrafficQuality: jest.fn(),
    };
    platformSettingsService = {
      getPlatformFeeBps: jest.fn().mockResolvedValue(2000),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: ANALYTICS_QUERY_STORE,
          useValue: store,
        },
        {
          provide: PlatformSettingsService,
          useValue: platformSettingsService,
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  it('passes the live platform fee down to the query store', async () => {
    store.getDailyMetrics.mockResolvedValue([]);

    await service.getDailyMetrics('2026-07-20', '2026-07-21');

    expect(store.getDailyMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ platformFeeBps: 2000 }),
    );
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

  it('summarizes traffic-quality rows into totals, by-reason, and by-date breakdowns', async () => {
    store.getTrafficQuality.mockResolvedValue([
      {
        date: '2026-07-20',
        stage: 'click',
        outcome: 'blocked',
        reason: 'CLICK_VELOCITY_EXCEEDED',
        count: 5,
      },
      {
        date: '2026-07-20',
        stage: 'click',
        outcome: 'blocked',
        reason: 'MISSING_CLICK_TOKEN',
        count: 3,
      },
      {
        date: '2026-07-21',
        stage: 'impression',
        outcome: 'flagged',
        reason: 'DATACENTER_IP',
        count: 2,
      },
    ]);

    await expect(
      service.getTrafficQuality({
        startDate: '2026-07-20',
        endDate: '2026-07-21',
      }),
    ).resolves.toEqual({
      totalBlocked: 8,
      totalFlagged: 2,
      byReason: [
        {
          reason: 'CLICK_VELOCITY_EXCEEDED',
          stage: 'click',
          blocked: 5,
          flagged: 0,
        },
        {
          reason: 'MISSING_CLICK_TOKEN',
          stage: 'click',
          blocked: 3,
          flagged: 0,
        },
        {
          reason: 'DATACENTER_IP',
          stage: 'impression',
          blocked: 0,
          flagged: 2,
        },
      ],
      byDate: [
        { date: '2026-07-20', blocked: 8, flagged: 0 },
        { date: '2026-07-21', blocked: 0, flagged: 2 },
      ],
    });
  });
});
