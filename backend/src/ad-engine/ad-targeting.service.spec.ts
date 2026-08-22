import { Test, TestingModule } from '@nestjs/testing';

import { AdTargetingService } from './ad-targeting.service';
import { CAMPAIGN_CACHE_STORE } from './campaign-cache-sync.service';
import type { CampaignCacheStore } from './campaign-cache.types';
import { PrismaService } from '../prisma/prisma.service';

describe('AdTargetingService', () => {
  let service: AdTargetingService;
  let campaignCacheStore: jest.Mocked<CampaignCacheStore>;
  let prisma: { adZone: { findUnique: jest.Mock } };

  beforeEach(async () => {
    campaignCacheStore = {
      replaceActiveCampaigns: jest.fn(),
      getActiveCampaigns: jest.fn(),
    };
    prisma = {
      adZone: {
        // Defaults to an active zone so the existing campaign-targeting
        // tests below don't each need to know about zone lookups.
        findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdTargetingService,
        {
          provide: CAMPAIGN_CACHE_STORE,
          useValue: campaignCacheStore,
        },
        {
          provide: PrismaService,
          useValue: prisma,
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

  it('never serves a campaign for a paused zone', async () => {
    prisma.adZone.findUnique.mockResolvedValue({ status: 'PAUSED' });
    campaignCacheStore.getActiveCampaigns.mockResolvedValue([
      {
        id: 'campaign-high',
        advertiserId: 'advertiser-1',
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
    ]);

    await expect(
      service.selectCampaign({
        zoneId: 'paused-zone',
        country: 'US',
        device: 'desktop',
      }),
    ).resolves.toBeNull();
    expect(campaignCacheStore.getActiveCampaigns).not.toHaveBeenCalled();
  });

  it('never serves a campaign for a zone that does not exist', async () => {
    prisma.adZone.findUnique.mockResolvedValue(null);

    await expect(
      service.selectCampaign({
        zoneId: 'nonexistent-zone',
        country: 'US',
        device: 'desktop',
      }),
    ).resolves.toBeNull();
    expect(campaignCacheStore.getActiveCampaigns).not.toHaveBeenCalled();
  });

  it('treats a malformed zoneId (failed lookup) as no zone rather than erroring', async () => {
    prisma.adZone.findUnique.mockRejectedValue(
      new Error('invalid input syntax for type uuid'),
    );

    await expect(
      service.selectCampaign({
        zoneId: 'not-a-uuid',
        country: 'US',
        device: 'desktop',
      }),
    ).resolves.toBeNull();
    expect(campaignCacheStore.getActiveCampaigns).not.toHaveBeenCalled();
  });
});
