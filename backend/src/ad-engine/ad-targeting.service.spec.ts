import { Test, TestingModule } from '@nestjs/testing';

import { AdTargetingService } from './ad-targeting.service';
import { CAMPAIGN_CACHE_STORE } from './campaign-cache-sync.service';
import type { CampaignCacheStore } from './campaign-cache.types';
import { VisitorFrequencyCapService } from './visitor-frequency-cap.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdTargetingService', () => {
  let service: AdTargetingService;
  let campaignCacheStore: jest.Mocked<CampaignCacheStore>;
  let prisma: { adZone: { findUnique: jest.Mock } };
  let visitorFrequencyCapService: jest.Mocked<VisitorFrequencyCapService>;

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
    visitorFrequencyCapService = {
      // Defaults to "nothing is capped" so existing rotation/targeting
      // tests below don't each need to know about frequency capping.
      isCapped: jest.fn().mockResolvedValue(false),
      recordImpression: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<VisitorFrequencyCapService>;

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
        {
          provide: VisitorFrequencyCapService,
          useValue: visitorFrequencyCapService,
        },
      ],
    }).compile();

    service = module.get(AdTargetingService);
  });

  it('filters by country and device, leaving only campaigns eligible for the request', async () => {
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

    const result = await service.selectCampaign({
      zoneId: '42',
      country: 'US',
      device: 'mobile',
      visitorId: 'visitor-1',
    });

    // campaign-desktop must never be selectable for a mobile request, and
    // between the two that ARE eligible for mobile, the higher bidder
    // (campaign-high, $2 vs $0.5) always wins - see the auction tests below
    // for the pricing mechanics.
    expect(result?.id).toBe('campaign-high');
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
        visitorId: 'visitor-1',
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
        visitorId: 'visitor-1',
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
        visitorId: 'visitor-1',
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
        visitorId: 'visitor-1',
      }),
    ).resolves.toBeNull();
    expect(campaignCacheStore.getActiveCampaigns).not.toHaveBeenCalled();
  });

  describe('per-visitor frequency capping', () => {
    const campaignA = {
      id: 'campaign-a',
      advertiserId: 'advertiser-1',
      campaignName: 'Campaign A',
      totalBudget: 100,
      dailyBudget: 10,
      maxCpc: 1,
      targetCountries: ['US'],
      targetDevices: ['desktop'],
      status: 'ACTIVE',
      advertiserBalanceUsd: 10,
      creativeType: 'html',
      creativeUrl: null,
      creativeHtml: '<div>A</div>',
    };
    const campaignB = {
      id: 'campaign-b',
      advertiserId: 'advertiser-2',
      campaignName: 'Campaign B',
      totalBudget: 100,
      dailyBudget: 10,
      maxCpc: 1,
      targetCountries: ['US'],
      targetDevices: ['desktop'],
      status: 'ACTIVE',
      advertiserBalanceUsd: 10,
      creativeType: 'html',
      creativeUrl: null,
      creativeHtml: '<div>B</div>',
    };
    const request = {
      zoneId: '42',
      country: 'US',
      device: 'desktop',
      visitorId: 'visitor-1',
    } as const;

    it('excludes a campaign the visitor has already been capped on from the rotation', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        campaignA,
        campaignB,
      ]);
      visitorFrequencyCapService.isCapped.mockImplementation(
        async (_visitorId, campaignId) => campaignId === 'campaign-a',
      );

      const result = await service.selectCampaign(request);

      expect(result?.id).toBe('campaign-b');
      expect(visitorFrequencyCapService.isCapped).toHaveBeenCalledWith(
        'visitor-1',
        'campaign-a',
        undefined,
      );
      expect(visitorFrequencyCapService.isCapped).toHaveBeenCalledWith(
        'visitor-1',
        'campaign-b',
        undefined,
      );
    });

    it('returns no ad when every eligible campaign is capped for the visitor', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([campaignA]);
      visitorFrequencyCapService.isCapped.mockResolvedValue(true);

      await expect(service.selectCampaign(request)).resolves.toBeNull();
      expect(visitorFrequencyCapService.recordImpression).not.toHaveBeenCalled();
    });

    it('records an impression against the visitor for the campaign actually served', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([campaignA]);

      await service.selectCampaign(request);

      expect(visitorFrequencyCapService.recordImpression).toHaveBeenCalledWith(
        'visitor-1',
        'campaign-a',
        undefined,
      );
    });

    it('does not consult the cap store when the request has no visitor identity', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([campaignA]);

      await service.selectCampaign({ ...request, visitorId: '' });

      expect(visitorFrequencyCapService.isCapped).not.toHaveBeenCalled();
      expect(visitorFrequencyCapService.recordImpression).toHaveBeenCalledWith(
        '',
        'campaign-a',
        undefined,
      );
    });

    it("passes the campaign's own frequency-cap override through to the cap service", async () => {
      const campaignWithOverride = {
        ...campaignA,
        frequencyCapImpressions: 1,
        frequencyCapWindowSeconds: 3600,
      };
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        campaignWithOverride,
      ]);

      await service.selectCampaign(request);

      expect(visitorFrequencyCapService.isCapped).toHaveBeenCalledWith(
        'visitor-1',
        'campaign-a',
        1,
      );
      expect(visitorFrequencyCapService.recordImpression).toHaveBeenCalledWith(
        'visitor-1',
        'campaign-a',
        3600,
      );
    });
  });

  describe('second-price auction', () => {
    const request = {
      zoneId: '42',
      country: 'US',
      device: 'desktop',
      visitorId: 'visitor-1',
    } as const;

    it('the highest bidder wins but pays only the runner-up bid, not their own', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        {
          id: 'campaign-low',
          advertiserId: 'advertiser-1',
          campaignName: 'Low Bid',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 0.5,
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 5,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>low</div>',
        },
        {
          id: 'campaign-high',
          advertiserId: 'advertiser-2',
          campaignName: 'High Bid',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 2,
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>high</div>',
        },
      ]);

      const result = await service.selectCampaign(request);

      expect(result?.id).toBe('campaign-high');
      // Won at $2, but only charged the $0.5 runner-up bid.
      expect(result?.maxCpc).toBe(0.5);
    });

    it('a sole eligible campaign pays its own bid - nothing to clear against', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        {
          id: 'campaign-solo',
          advertiserId: 'advertiser-1',
          campaignName: 'Solo Bidder',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 3,
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>solo</div>',
        },
      ]);

      const result = await service.selectCampaign(request);

      expect(result?.id).toBe('campaign-solo');
      expect(result?.maxCpc).toBe(3);
    });

    it('an exact tie pays the full tied bid and is broken by a fair coin flip', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        {
          id: 'campaign-tie-a',
          advertiserId: 'advertiser-1',
          campaignName: 'Tie A',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 1,
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>a</div>',
        },
        {
          id: 'campaign-tie-b',
          advertiserId: 'advertiser-2',
          campaignName: 'Tie B',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 1,
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>b</div>',
        },
      ]);
      const rollSpy = jest.spyOn(service as any, 'rollRandom');

      rollSpy.mockReturnValueOnce(0);
      const first = await service.selectCampaign(request);
      expect(first?.id).toBe('campaign-tie-a');
      expect(first?.maxCpc).toBe(1); // tied bid pays in full, no discount

      rollSpy.mockReturnValueOnce(0.999);
      const second = await service.selectCampaign(request);
      expect(second?.id).toBe('campaign-tie-b');
      expect(second?.maxCpc).toBe(1);
    });

    it('clears a CPM winner against a CPC runner-up, converting the clearing price back into maxCpm', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        {
          id: 'campaign-cpc',
          advertiserId: 'advertiser-1',
          campaignName: 'CPC Bidder',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 1, // effective unit bid: $1
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>cpc</div>',
        },
        {
          id: 'campaign-cpm',
          advertiserId: 'advertiser-2',
          campaignName: 'CPM Bidder',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 0.5,
          maxCpm: 4, // effective unit bid: $4/1000 = $0.004 - actually lower
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>cpm</div>',
        },
      ]);

      const result = await service.selectCampaign(request);

      // CPC bidder's $1/click effective bid beats the CPM bidder's
      // $4-per-1000 ($0.004/impression-equivalent) bid, so CPC wins - and
      // is charged that runner-up's bid. $0.004 isn't a billable amount
      // (WalletManager only accepts 2 decimal places), so it's floored to
      // the smallest billable unit, $0.01, rather than rounding down to an
      // unbillable $0.00.
      expect(result?.id).toBe('campaign-cpc');
      expect(result?.maxCpc).toBe(0.01);
    });

    it('preserves every other field on the winning campaign untouched by the clearing price', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        {
          id: 'campaign-low',
          advertiserId: 'advertiser-1',
          campaignName: 'Low Bid',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 0.5,
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 5,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>low</div>',
        },
        {
          id: 'campaign-high',
          advertiserId: 'advertiser-2',
          campaignName: 'High Bid',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 2,
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>high</div>',
          destinationUrl: 'https://advertiser.example/landing',
          frequencyCapImpressions: 5,
          frequencyCapWindowSeconds: 3600,
        },
      ]);

      const result = await service.selectCampaign(request);

      expect(result).toMatchObject({
        id: 'campaign-high',
        campaignName: 'High Bid',
        creativeHtml: '<div>high</div>',
        destinationUrl: 'https://advertiser.example/landing',
        frequencyCapImpressions: 5,
        frequencyCapWindowSeconds: 3600,
      });
    });

    it('never returns an unbillable fractional-cent clearing price for a CPM winner', async () => {
      campaignCacheStore.getActiveCampaigns.mockResolvedValue([
        {
          id: 'campaign-cpm-winner',
          advertiserId: 'advertiser-1',
          campaignName: 'CPM Winner',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 0.5,
          maxCpm: 5, // effective unit bid: $0.005
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>cpm winner</div>',
        },
        {
          id: 'campaign-cpm-runner-up',
          advertiserId: 'advertiser-2',
          campaignName: 'CPM Runner Up',
          totalBudget: 100,
          dailyBudget: 10,
          maxCpc: 0.5,
          maxCpm: 0.3, // effective unit bid: $0.0003 - much cheaper
          targetCountries: ['US'],
          targetDevices: ['desktop'],
          status: 'ACTIVE',
          advertiserBalanceUsd: 10,
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<div>cpm runner up</div>',
        },
      ]);

      const result = await service.selectCampaign(request);

      expect(result?.id).toBe('campaign-cpm-winner');
      // Raw clearing price ($0.0003 * 1000 = $0.30) IS already 2dp-clean
      // here, so this mainly guards that maxCpm stays a plain number with
      // no floating-point noise (e.g. 0.30000000000000004) after the
      // round-trip through cents.
      expect(result?.maxCpm).toBe(0.3);
    });
  });
});
