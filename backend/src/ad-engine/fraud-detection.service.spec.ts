import { Test, TestingModule } from '@nestjs/testing';

import { BLACKLIST_CACHE_STORE } from './blacklist-cache-sync.service';
import type { BlacklistCacheStore } from './blacklist-cache.types';
import { ClickIntegrityService } from './click-integrity.service';
import { DatacenterIpService } from './datacenter-ip.service';
import { FrequencyCappingService } from './frequency-capping.service';
import { FraudDetectionService } from './fraud-detection.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;
  let clickIntegrityService: ClickIntegrityService;
  const prismaService = {
    blacklistedIp: {
      upsert: jest.fn(),
    },
  };
  const blacklistCacheStore: jest.Mocked<BlacklistCacheStore> = {
    replaceBlacklistedIps: jest.fn(),
    isBlacklisted: jest.fn(),
  };
  const frequencyCappingService = {
    evaluateImpression: jest.fn(),
    evaluateClick: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    frequencyCappingService.evaluateImpression.mockResolvedValue({
      allowed: true,
      key: 'rate:imp:127.0.0.1',
      count: 1,
      limit: 2,
      ttlSeconds: 30,
    });
    frequencyCappingService.evaluateClick.mockResolvedValue({
      allowed: true,
      key: 'rate:click:127.0.0.1',
      count: 1,
      limit: 3,
      ttlSeconds: 60,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        ClickIntegrityService,
        DatacenterIpService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: FrequencyCappingService,
          useValue: frequencyCappingService,
        },
        {
          provide: BLACKLIST_CACHE_STORE,
          useValue: blacklistCacheStore,
        },
      ],
    }).compile();

    service = module.get(FraudDetectionService);
    clickIntegrityService = module.get(ClickIntegrityService);
  });

  it('blocks IPs already stored in the blacklist cache', async () => {
    blacklistCacheStore.isBlacklisted.mockResolvedValue(true);

    await expect(
      service.evaluateServeRequest('::ffff:127.0.0.1', 'Mozilla/5.0'),
    ).resolves.toEqual({
      blocked: true,
      reason: 'IP_BLACKLISTED',
    });
  });

  it('blocks missing and known automation user agents', async () => {
    blacklistCacheStore.isBlacklisted.mockResolvedValue(false);

    await expect(
      service.evaluateServeRequest('127.0.0.1', ''),
    ).resolves.toEqual({
      blocked: true,
      reason: 'MISSING_USER_AGENT',
    });
    await expect(
      service.evaluateServeRequest('127.0.0.1', 'python-requests/2.31'),
    ).resolves.toEqual({
      blocked: true,
      reason: 'SUSPICIOUS_USER_AGENT',
    });
  });

  it('allows normal browser profiles not present in the blacklist', async () => {
    blacklistCacheStore.isBlacklisted.mockResolvedValue(false);

    await expect(
      service.evaluateServeRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36'),
    ).resolves.toEqual({
      blocked: false,
    });
    expect(frequencyCappingService.evaluateImpression).toHaveBeenCalledWith(
      '127.0.0.1',
    );
  });

  it('blocks traffic after the Redis velocity cap is exceeded', async () => {
    blacklistCacheStore.isBlacklisted.mockResolvedValue(false);
    frequencyCappingService.evaluateImpression.mockResolvedValue({
      allowed: false,
      key: 'rate:imp:127.0.0.1',
      count: 3,
      limit: 2,
      ttlSeconds: 30,
      reason: 'IMPRESSION_VELOCITY_EXCEEDED',
    });

    await expect(
      service.evaluateServeRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36'),
    ).resolves.toEqual({
      blocked: true,
      reason: 'IMPRESSION_VELOCITY_EXCEEDED',
    });
  });

  it('allows normal click traffic and checks the click velocity cap, not the impression cap', async () => {
    blacklistCacheStore.isBlacklisted.mockResolvedValue(false);

    await expect(
      service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36'),
    ).resolves.toEqual({
      blocked: false,
    });
    expect(frequencyCappingService.evaluateClick).toHaveBeenCalledWith(
      '127.0.0.1',
    );
    expect(frequencyCappingService.evaluateImpression).not.toHaveBeenCalled();
  });

  it('blocks click traffic once the click velocity cap is exceeded', async () => {
    blacklistCacheStore.isBlacklisted.mockResolvedValue(false);
    frequencyCappingService.evaluateClick.mockResolvedValue({
      allowed: false,
      key: 'rate:click:127.0.0.1',
      count: 4,
      limit: 3,
      ttlSeconds: 60,
      reason: 'CLICK_VELOCITY_EXCEEDED',
    });

    await expect(
      service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36'),
    ).resolves.toEqual({
      blocked: true,
      reason: 'CLICK_VELOCITY_EXCEEDED',
    });
  });

  it('blocks blacklisted IPs and known automation user agents on the click path too', async () => {
    blacklistCacheStore.isBlacklisted.mockResolvedValue(true);

    await expect(
      service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0'),
    ).resolves.toEqual({
      blocked: true,
      reason: 'IP_BLACKLISTED',
    });
  });

  it('permanently records honeypot hits with normalized IP address', async () => {
    prismaService.blacklistedIp.upsert.mockResolvedValue({
      ipAddress: '127.0.0.1',
      source: 'HONEYPOT',
    });

    await service.recordHoneypotHit('::ffff:127.0.0.1', 'BadBot/1.0');

    expect(prismaService.blacklistedIp.upsert).toHaveBeenCalledWith({
      where: { ipAddress: '127.0.0.1' },
      update: {
        source: 'HONEYPOT',
        reason: 'Hidden honeypot link requested by BadBot/1.0',
      },
      create: {
        ipAddress: '127.0.0.1',
        source: 'HONEYPOT',
        reason: 'Hidden honeypot link requested by BadBot/1.0',
      },
    });
  });

  describe('click integrity (no-impression / replayed clicks)', () => {
    const zoneId = 'zone-1';
    const campaignId = 'campaign-1';

    it('blocks a billable click with no click token at all', async () => {
      blacklistCacheStore.isBlacklisted.mockResolvedValue(false);

      await expect(
        service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36', {
          zoneId,
          campaignId,
          billable: true,
        }),
      ).resolves.toEqual({
        blocked: true,
        reason: 'MISSING_CLICK_TOKEN',
      });
    });

    it('blocks a billable click whose token was issued for a different campaign', async () => {
      blacklistCacheStore.isBlacklisted.mockResolvedValue(false);
      const token = clickIntegrityService.sign(
        zoneId,
        'some-other-campaign',
        Date.now() - 1000,
      );

      await expect(
        service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36', {
          zoneId,
          campaignId,
          clickToken: token,
          billable: true,
        }),
      ).resolves.toEqual({
        blocked: true,
        reason: 'CLICK_TOKEN_SCOPE_MISMATCH',
      });
    });

    it('blocks a billable click fired faster than a human can react', async () => {
      blacklistCacheStore.isBlacklisted.mockResolvedValue(false);
      const token = clickIntegrityService.sign(zoneId, campaignId, Date.now());

      await expect(
        service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36', {
          zoneId,
          campaignId,
          clickToken: token,
          billable: true,
        }),
      ).resolves.toEqual({
        blocked: true,
        reason: 'CLICK_TOKEN_EXPIRED',
      });
    });

    it('flags rather than blocks the same bad token on a non-billable click', async () => {
      blacklistCacheStore.isBlacklisted.mockResolvedValue(false);

      await expect(
        service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36', {
          zoneId,
          campaignId,
          billable: false,
        }),
      ).resolves.toEqual({
        blocked: false,
        flagged: true,
        reason: 'MISSING_CLICK_TOKEN',
      });
    });

    it('allows a billable click carrying a valid, freshly-issued token', async () => {
      blacklistCacheStore.isBlacklisted.mockResolvedValue(false);
      const token = clickIntegrityService.sign(
        zoneId,
        campaignId,
        Date.now() - 1000,
      );

      await expect(
        service.evaluateClickRequest('127.0.0.1', 'Mozilla/5.0 Safari/537.36', {
          zoneId,
          campaignId,
          clickToken: token,
          billable: true,
        }),
      ).resolves.toEqual({
        blocked: false,
      });
    });
  });

  describe('datacenter IP detection', () => {
    const zoneId = 'zone-1';
    const campaignId = 'campaign-1';
    // 52.x.x.x falls inside the AWS range in DatacenterIpService's table.
    const datacenterIp = '52.10.20.30';

    it('flags (does not block) an impression served to a datacenter IP', async () => {
      blacklistCacheStore.isBlacklisted.mockResolvedValue(false);

      await expect(
        service.evaluateServeRequest(datacenterIp, 'Mozilla/5.0 Safari/537.36'),
      ).resolves.toEqual({
        blocked: false,
        flagged: true,
        reason: 'DATACENTER_IP',
      });
    });

    it('blocks a billable click from a datacenter IP even with a valid token', async () => {
      blacklistCacheStore.isBlacklisted.mockResolvedValue(false);
      const token = clickIntegrityService.sign(
        zoneId,
        campaignId,
        Date.now() - 1000,
      );

      await expect(
        service.evaluateClickRequest(datacenterIp, 'Mozilla/5.0 Safari/537.36', {
          zoneId,
          campaignId,
          clickToken: token,
          billable: true,
        }),
      ).resolves.toEqual({
        blocked: true,
        reason: 'DATACENTER_IP_CLICK',
      });
    });
  });
});
