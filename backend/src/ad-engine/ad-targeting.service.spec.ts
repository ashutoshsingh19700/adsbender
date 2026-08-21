import { Test, TestingModule } from '@nestjs/testing';

import { AdTargetingService } from './ad-targeting.service';
import { CAMPAIGN_CACHE_STORE } from './campaign-cache-sync.service';
import type { CampaignCacheStore } from './campaign-cache.types';

describe('AdTargetingService', () => {
  let service: AdTargetingService;
  let campaignCacheStore: jest.Mocked<CampaignCacheStore>;

  beforeEach(async () => {
    campaignCacheStore = {
      replaceActiveCampaigns: jest.fn(),
      getActiveCampaigns: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdTargetingService,
        {
          provide: CAMPAIGN_CACHE_STORE,
          useValue: campaignCacheStore,
        },
      ],
    }).compile();

    service = module.get(AdTargetingService);
  });

  it('filters by country and device, then selects the highest max CPC campaign', async () => {
    campaignCacheStore.getActiveCampaigns.mockResolvedValue([
      {
        id: 'campaign-low',
        advertiserId: 'advertiser-1',
        campaignName: 'US Mobile Low Bid',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 0.5,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 5,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
      {
        id: 'campaign-desktop',
        advertiserId: 'advertiser-2',
        campaignName: 'US Desktop',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 9,
        targetCountries: ['US'],
        targetDevices: ['desktop'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 20,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
      {
        id: 'campaign-high',
        advertiserId: 'advertiser-3',
        campaignName: 'US Mobile High Bid',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 2,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 10,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
    ]);

    await expect(
      service.selectCampaign({
        zoneId: '42',
        country: 'US',
        device: 'mobile',
      }),
    ).resolves.toMatchObject({
      id: 'campaign-high',
      maxCpc: 2,
    });
  });

  it('rejects unfunded, paused, and non-targeted campaigns', async () => {
    campaignCacheStore.getActiveCampaigns.mockResolvedValue([
      {
        id: 'campaign-unfunded',
        advertiserId: 'advertiser-1',
        campaignName: 'Unfunded',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 5,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 5,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
      {
        id: 'campaign-paused',
        advertiserId: 'advertiser-2',
        campaignName: 'Paused',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 1,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        status: 'PAUSED',
        advertiserBalanceUsd: 10,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
      {
        id: 'campaign-country-miss',
        advertiserId: 'advertiser-3',
        campaignName: 'India Only',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 1,
        targetCountries: ['IN'],
        targetDevices: ['mobile'],
        status: 'ACTIVE',
        advertiserBalanceUsd: 10,
        creativeType: 'html',
        creativeUrl: null,
        creativeHtml: '<div>ad</div>',
      },
    ]);

    await expect(
      service.selectCampaign({
        zoneId: '42',
        country: 'US',
        device: 'mobile',
      }),
    ).resolves.toBeNull();
  });
});
