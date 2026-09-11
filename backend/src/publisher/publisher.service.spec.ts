import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdZoneStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ClickIntegrityService } from '../ad-engine/click-integrity.service';
import { PublisherService } from './publisher.service';

describe('PublisherService', () => {
  let service: PublisherService;
  const prismaService = {
    publisherSite: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    adZone: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const analyticsService = {
    getDailyMetrics: jest.fn(),
    getGroupedMetrics: jest.fn(),
    getTrafficQuality: jest.fn(),
  };
  const clickIntegrityService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('adnetwork-verify=publisher-1'),
    } as any);
    clickIntegrityService.sign.mockReturnValue('signed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublisherService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: ClickIntegrityService, useValue: clickIntegrityService },
      ],
    }).compile();

    service = module.get(PublisherService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates publisher ads.txt and persists the verified domain entry', async () => {
    prismaService.publisherSite.upsert.mockResolvedValue({
      id: 'site-1',
      domain: 'publisher-site.com',
      verified: true,
    });

    await expect(
      service.validateDomain('publisher-1', {
        domain: 'https://publisher-site.com/page',
      }),
    ).resolves.toEqual({
      id: 'site-1',
      domain: 'publisher-site.com',
      verified: true,
    });
    expect(fetch).toHaveBeenCalledWith('https://publisher-site.com/ads.txt');
  });

  it('rejects domains missing the required ads.txt verification text', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('other-network=123'),
    } as any);

    await expect(
      service.validateDomain('publisher-1', { domain: 'publisher-site.com' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects with a clean error instead of throwing when the domain is unreachable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      service.validateDomain('publisher-1', { domain: 'not-a-real-domain.test' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an ad zone and returns a copy-ready async script snippet', async () => {
    prismaService.adZone.create.mockResolvedValue({
      id: 'zone-42',
      publisherId: 'publisher-1',
      zoneName: 'Homepage rectangle',
      width: 300,
      height: 250,
      layoutType: 'MEDIUM_RECTANGLE_300X250',
    });

    await expect(
      service.createAdZone('publisher-1', {
        zoneName: 'Homepage rectangle',
        width: 300,
        height: 250,
        layoutType: 'MEDIUM_RECTANGLE_300X250',
      }),
    ).resolves.toEqual({
      zone: expect.objectContaining({ id: 'zone-42' }),
      // Not hardcoding the host:port here - it comes from PUBLIC_TAG_URL,
      // which is machine/environment specific (see .env).
      snippet: expect.stringContaining(
        '<section data-zone-id="zone-42"></section>\n<script async src="',
      ),
    });
  });

  it("blocks a publisher from reading another publisher's ad zone", async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      publisherId: 'someone-else',
      status: AdZoneStatus.ACTIVE,
    });

    await expect(service.getAdZone('publisher-1', 'zone-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("blocks a publisher from updating another publisher's ad zone", async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      publisherId: 'someone-else',
      status: AdZoneStatus.ACTIVE,
    });

    await expect(
      service.updateAdZone('publisher-1', 'zone-1', { zoneName: 'Hijack' }),
    ).rejects.toThrow(NotFoundException);
    expect(prismaService.adZone.update).not.toHaveBeenCalled();
  });

  it('rejects editing an archived ad zone', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      publisherId: 'publisher-1',
      status: AdZoneStatus.ARCHIVED,
    });

    await expect(
      service.updateAdZone('publisher-1', 'zone-1', { zoneName: 'New name' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows pausing an active ad zone', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      publisherId: 'publisher-1',
      status: AdZoneStatus.ACTIVE,
    });
    prismaService.adZone.update.mockResolvedValue({
      id: 'zone-1',
      status: AdZoneStatus.PAUSED,
    });

    await expect(
      service.updateAdZoneStatus('publisher-1', 'zone-1', {
        status: AdZoneStatus.PAUSED,
      }),
    ).resolves.toEqual({ id: 'zone-1', status: 'PAUSED' });
  });

  it('rejects re-activating an archived ad zone (terminal state)', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      publisherId: 'publisher-1',
      status: AdZoneStatus.ARCHIVED,
    });

    await expect(
      service.updateAdZoneStatus('publisher-1', 'zone-1', {
        status: AdZoneStatus.ACTIVE,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.adZone.update).not.toHaveBeenCalled();
  });

  it('scopes ad-zone performance lookups to the owning publisher and zone', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      publisherId: 'publisher-1',
      status: AdZoneStatus.ACTIVE,
    });
    analyticsService.getDailyMetrics.mockResolvedValue({
      rows: [],
      totals: { impressions: 0, clicks: 0, ctr: 0, spend: 0, payout: 0 },
    });

    await service.getAdZonePerformance(
      'publisher-1',
      'zone-1',
      '2026-08-01',
      '2026-08-13',
    );

    expect(analyticsService.getDailyMetrics).toHaveBeenCalledWith(
      '2026-08-01',
      '2026-08-13',
      { zoneId: 'zone-1' },
    );
  });

  it('scopes traffic-quality to every zone this publisher owns', async () => {
    prismaService.adZone.findMany.mockResolvedValue([
      { id: 'zone-1' },
      { id: 'zone-2' },
    ]);
    analyticsService.getTrafficQuality.mockResolvedValue({
      totalBlocked: 3,
      totalFlagged: 1,
      byReason: [],
      byDate: [],
    });

    await service.getTrafficQuality('publisher-1', {
      startDate: '2026-08-01',
      endDate: '2026-08-13',
    });

    expect(prismaService.adZone.findMany).toHaveBeenCalledWith({
      where: { publisherId: 'publisher-1' },
      select: { id: true },
    });
    expect(analyticsService.getTrafficQuality).toHaveBeenCalledWith({
      startDate: '2026-08-01',
      endDate: '2026-08-13',
      zoneIds: ['zone-1', 'zone-2'],
    });
  });

  it('scopes traffic-quality to a single owned zone when zoneId is given', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      publisherId: 'publisher-1',
      status: AdZoneStatus.ACTIVE,
    });
    analyticsService.getTrafficQuality.mockResolvedValue({
      totalBlocked: 0,
      totalFlagged: 0,
      byReason: [],
      byDate: [],
    });

    await service.getTrafficQuality('publisher-1', {
      startDate: '2026-08-01',
      endDate: '2026-08-13',
      zoneId: 'zone-1',
    });

    expect(prismaService.adZone.findMany).not.toHaveBeenCalled();
    expect(analyticsService.getTrafficQuality).toHaveBeenCalledWith({
      startDate: '2026-08-01',
      endDate: '2026-08-13',
      zoneIds: ['zone-1'],
    });
  });

  describe('getNewsletterSnippet', () => {
    it('rejects a zone that was not built for Newsletter Sponsorship', async () => {
      prismaService.adZone.findUnique.mockResolvedValue({
        id: 'zone-1',
        publisherId: 'publisher-1',
        status: AdZoneStatus.ACTIVE,
        layoutType: 'MEDIUM_RECTANGLE_300X250',
      });

      await expect(
        service.getNewsletterSnippet('publisher-1', 'zone-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns a placeholder comment when no campaign is currently sponsoring the newsletter', async () => {
      prismaService.adZone.findUnique.mockResolvedValue({
        id: 'zone-1',
        publisherId: 'publisher-1',
        status: AdZoneStatus.ACTIVE,
        layoutType: 'NEWSLETTER_SPONSORSHIP',
      });
      prismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getNewsletterSnippet('publisher-1', 'zone-1');

      expect(result.snippet).toContain('No sponsor is currently live');
    });

    it('builds a static HTML snippet with a tracking pixel and a signed click link for the top-bidding campaign', async () => {
      prismaService.adZone.findUnique.mockResolvedValue({
        id: 'zone-1',
        publisherId: 'publisher-1',
        status: AdZoneStatus.ACTIVE,
        layoutType: 'NEWSLETTER_SPONSORSHIP',
      });
      prismaService.$queryRaw.mockResolvedValue([
        {
          id: 'campaign-1',
          advertiserId: 'advertiser-1',
          creativeType: 'html',
          creativeUrl: null,
          creativeHtml: '<p>Buy our thing</p>',
          destinationUrl: 'https://advertiser.example/landing',
          maxCpc: '1.00',
          maxCpm: null,
        },
      ]);

      const result = await service.getNewsletterSnippet('publisher-1', 'zone-1');

      expect(result.snippet).toContain('<p>Buy our thing</p>');
      expect(result.snippet).toContain('/api/v1/click?');
      expect(result.snippet).toContain('/api/v1/pixel?');
      expect(result.snippet).toContain('campaignId=campaign-1');
      expect(result.snippet).toContain('t=signed-token');
      expect(clickIntegrityService.sign).toHaveBeenCalledWith(
        'zone-1',
        'campaign-1',
      );
    });
  });
});
