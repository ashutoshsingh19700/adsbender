import { Prisma } from '@prisma/client';

import {
  ACTIVE_CAMPAIGNS_SET_KEY,
  RedisCampaignCacheStore,
  campaignCacheKey,
} from './redis-campaign-cache.store';
import { RedisRespClient } from './redis-resp.client';

describe('RedisCampaignCacheStore', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let store: RedisCampaignCacheStore;

  beforeEach(() => {
    commandSpy = jest
      .spyOn(RedisRespClient.prototype, 'command')
      .mockImplementation(async (args) => {
        if (args[0] === 'SMEMBERS') {
          return ['campaign-1', 'paused-campaign'];
        }

        return 1;
      });
    store = new RedisCampaignCacheStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    store.onModuleDestroy();
  });

  it('serializes active campaigns into Redis hashes and the active campaign set', async () => {
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

    expect(commandSpy).toHaveBeenCalledWith([
      'SMEMBERS',
      ACTIVE_CAMPAIGNS_SET_KEY,
    ]);
    expect(commandSpy).toHaveBeenCalledWith([
      'DEL',
      campaignCacheKey('paused-campaign'),
    ]);
    expect(commandSpy).toHaveBeenCalledWith(['DEL', ACTIVE_CAMPAIGNS_SET_KEY]);
    expect(commandSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        'HSET',
        campaignCacheKey('campaign-1'),
        'id',
        'campaign-1',
        'status',
        'ACTIVE',
        'targetCountries',
        '["US"]',
        'targetDevices',
        '["mobile"]',
      ]),
    );
    expect(commandSpy).toHaveBeenCalledWith([
      'SADD',
      ACTIVE_CAMPAIGNS_SET_KEY,
      'campaign-1',
    ]);
  });

  it('clears the active set when no active funded campaigns remain', async () => {
    await store.replaceActiveCampaigns([]);

    expect(commandSpy).toHaveBeenCalledWith([
      'DEL',
      campaignCacheKey('campaign-1'),
    ]);
    expect(commandSpy).toHaveBeenCalledWith([
      'DEL',
      campaignCacheKey('paused-campaign'),
    ]);
    expect(commandSpy).toHaveBeenCalledWith(['DEL', ACTIVE_CAMPAIGNS_SET_KEY]);
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

    expect(commandSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        'HSET',
        campaignCacheKey('campaign-2'),
        'destinationUrl',
        'https://advertiser.example/landing',
      ]),
    );
  });

  it('reads active campaign hashes back from Redis for serve-time targeting', async () => {
    commandSpy.mockImplementation(async (args) => {
      if (args[0] === 'SMEMBERS') {
        return ['campaign-1'];
      }

      if (args[0] === 'HGETALL') {
        return [
          'id',
          'campaign-1',
          'advertiserId',
          'advertiser-1',
          'campaignName',
          'US Mobile Banner',
          'totalBudget',
          '100',
          'dailyBudget',
          '10',
          'maxCpc',
          '2.5',
          'targetCountries',
          '["US"]',
          'targetDevices',
          '["mobile"]',
          'status',
          'ACTIVE',
          'advertiserBalanceUsd',
          '25',
          'creativeType',
          'html',
          'creativeUrl',
          '',
          'creativeHtml',
          '<div>ad</div>',
        ];
      }

      return 1;
    });

    await expect(store.getActiveCampaigns()).resolves.toEqual([
      {
        id: 'campaign-1',
        advertiserId: 'advertiser-1',
        campaignName: 'US Mobile Banner',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 2.5,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 25,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
        destinationUrl: null,
      },
    ]);
  });
});
