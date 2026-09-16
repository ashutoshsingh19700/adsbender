import { Prisma } from '@prisma/client';

import {
  ACTIVE_CAMPAIGNS_KEY,
  RedisCampaignCacheStore,
} from './redis-campaign-cache.store';
import { RedisRespClient } from './redis-resp.client';

describe('RedisCampaignCacheStore', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let store: RedisCampaignCacheStore;

  beforeEach(() => {
    commandSpy = jest
      .spyOn(RedisRespClient.prototype, 'command')
      .mockImplementation(async () => null);
    store = new RedisCampaignCacheStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    store.onModuleDestroy();
  });

  it('serializes the active campaign list into a single JSON blob (one Redis command)', async () => {
    await store.replaceActiveCampaigns([
      {
        id: 'campaign-1',
        advertiserId: 'advertiser-1',
        campaignName: 'US Mobile Banner',
        totalBudget: new Prisma.Decimal('100.00'),
        dailyBudget: new Prisma.Decimal('10.00'),
        maxCpc: new Prisma.Decimal('1.00'),
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: new Prisma.Decimal('5.00'),
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
    ]);

    expect(commandSpy).toHaveBeenCalledTimes(1);
    const [command, key, payload] = commandSpy.mock.calls[0][0];
    expect(command).toBe('SET');
    expect(key).toBe(ACTIVE_CAMPAIGNS_KEY);
    expect(JSON.parse(payload as string)).toEqual([
      {
        id: 'campaign-1',
        advertiserId: 'advertiser-1',
        campaignName: 'US Mobile Banner',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 1,
        maxCpm: null,
        maxCpa: null,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 5,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
        destinationUrl: null,
        adFormat: null,
        frequencyCapImpressions: null,
        frequencyCapWindowSeconds: null,
      },
    ]);
  });

  it('writes an empty JSON array when no active funded campaigns remain', async () => {
    await store.replaceActiveCampaigns([]);

    expect(commandSpy).toHaveBeenCalledWith(['SET', ACTIVE_CAMPAIGNS_KEY, '[]']);
  });

  it('round-trips destinationUrl for a click-tracked image creative', async () => {
    await store.replaceActiveCampaigns([
      {
        id: 'campaign-2',
        advertiserId: 'advertiser-1',
        campaignName: 'Image With Destination',
        totalBudget: new Prisma.Decimal('100.00'),
        dailyBudget: new Prisma.Decimal('10.00'),
        maxCpc: new Prisma.Decimal('1.00'),
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: new Prisma.Decimal('5.00'),
        creativeType: 'image',
        creativeUrl: 'https://cdn.example.com/ad.png',
        creativeHtml: null,
        destinationUrl: 'https://advertiser.example/landing',
      },
    ]);

    const [, , payload] = commandSpy.mock.calls[0][0];
    expect(JSON.parse(payload as string)[0]).toMatchObject({
      destinationUrl: 'https://advertiser.example/landing',
    });
  });

  it('reads the active campaign blob back from Redis for serve-time targeting (one Redis command)', async () => {
    const stored = [
      {
        id: 'campaign-1',
        advertiserId: 'advertiser-1',
        campaignName: 'US Mobile Banner',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 2.5,
        maxCpm: null,
        maxCpa: null,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 25,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
        destinationUrl: null,
        adFormat: null,
        frequencyCapImpressions: null,
        frequencyCapWindowSeconds: null,
      },
    ];
    commandSpy.mockImplementation(async (args) => {
      if (args[0] === 'GET') {
        return JSON.stringify(stored);
      }

      return null;
    });

    await expect(store.getActiveCampaigns()).resolves.toEqual(stored);
    expect(commandSpy).toHaveBeenCalledTimes(1);
    expect(commandSpy).toHaveBeenCalledWith(['GET', ACTIVE_CAMPAIGNS_KEY]);
  });

  it('returns an empty list when the cache has never been populated', async () => {
    commandSpy.mockImplementation(async () => null);

    await expect(store.getActiveCampaigns()).resolves.toEqual([]);
  });

  it('round-trips a CPM bid', async () => {
    await store.replaceActiveCampaigns([
      {
        id: 'campaign-4',
        advertiserId: 'advertiser-1',
        campaignName: 'CPM Campaign',
        totalBudget: new Prisma.Decimal('100.00'),
        dailyBudget: new Prisma.Decimal('10.00'),
        maxCpc: new Prisma.Decimal('1.00'),
        maxCpm: new Prisma.Decimal('2.50'),
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: new Prisma.Decimal('5.00'),
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
    ]);

    const [, , payload] = commandSpy.mock.calls[0][0];
    expect(JSON.parse(payload as string)[0]).toMatchObject({ maxCpm: 2.5 });
  });

  it('round-trips a CPA bid', async () => {
    await store.replaceActiveCampaigns([
      {
        id: 'campaign-5',
        advertiserId: 'advertiser-1',
        campaignName: 'CPA Campaign',
        totalBudget: new Prisma.Decimal('100.00'),
        dailyBudget: new Prisma.Decimal('10.00'),
        maxCpc: new Prisma.Decimal('1.00'),
        maxCpa: new Prisma.Decimal('15.00'),
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: new Prisma.Decimal('5.00'),
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
    ]);

    const [, , payload] = commandSpy.mock.calls[0][0];
    expect(JSON.parse(payload as string)[0]).toMatchObject({ maxCpa: 15 });
  });

  it('round-trips a per-campaign frequency cap override', async () => {
    await store.replaceActiveCampaigns([
      {
        id: 'campaign-3',
        advertiserId: 'advertiser-1',
        campaignName: 'Custom Cap',
        totalBudget: new Prisma.Decimal('100.00'),
        dailyBudget: new Prisma.Decimal('10.00'),
        maxCpc: new Prisma.Decimal('1.00'),
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: new Prisma.Decimal('5.00'),
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
        frequencyCapImpressions: 5,
        frequencyCapWindowSeconds: 3600,
      },
    ]);

    const [, , payload] = commandSpy.mock.calls[0][0];
    expect(JSON.parse(payload as string)[0]).toMatchObject({
      frequencyCapImpressions: 5,
      frequencyCapWindowSeconds: 3600,
    });
  });
});
