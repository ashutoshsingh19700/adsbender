import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
  DEFAULT_PLATFORM_FEE_BPS,
  PLATFORM_SETTING_ID,
  PlatformSettingsService,
} from './platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let prisma: {
    platformSetting: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      platformSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PlatformSettingsService);
  });

  describe('getPlatformFeeBps', () => {
    it('returns the stored fee when a row exists', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue({
        id: PLATFORM_SETTING_ID,
        platformFeeBps: 1500,
      });

      await expect(service.getPlatformFeeBps()).resolves.toBe(1500);
    });

    it('falls back to the 20% default when no row exists yet', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(null);

      await expect(service.getPlatformFeeBps()).resolves.toBe(
        DEFAULT_PLATFORM_FEE_BPS,
      );
    });

    it('caches the value so a second call within the TTL skips the DB', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue({
        id: PLATFORM_SETTING_ID,
        platformFeeBps: 1500,
      });

      await service.getPlatformFeeBps();
      await service.getPlatformFeeBps();

      expect(prisma.platformSetting.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('updatePlatformFeeBps', () => {
    it('upserts the new fee and returns it', async () => {
      prisma.platformSetting.upsert.mockResolvedValue({
        id: PLATFORM_SETTING_ID,
        platformFeeBps: 2500,
      });

      await expect(service.updatePlatformFeeBps(2500)).resolves.toEqual({
        platformFeeBps: 2500,
      });
      expect(prisma.platformSetting.upsert).toHaveBeenCalledWith({
        where: { id: PLATFORM_SETTING_ID },
        update: { platformFeeBps: 2500 },
        create: { id: PLATFORM_SETTING_ID, platformFeeBps: 2500 },
      });
    });

    it('immediately reflects the new value in getPlatformFeeBps, without waiting for the cache to expire', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue({
        id: PLATFORM_SETTING_ID,
        platformFeeBps: 2000,
      });
      await service.getPlatformFeeBps(); // warms the cache at 2000

      prisma.platformSetting.upsert.mockResolvedValue({
        id: PLATFORM_SETTING_ID,
        platformFeeBps: 3500,
      });
      await service.updatePlatformFeeBps(3500);

      await expect(service.getPlatformFeeBps()).resolves.toBe(3500);
      // Only the initial warm-up call - the post-update read must come from
      // the refreshed cache, not a second DB round trip.
      expect(prisma.platformSetting.findUnique).toHaveBeenCalledTimes(1);
    });

    it.each([-1, 10_001, 1.5])(
      'rejects an out-of-range or non-integer fee (%p)',
      async (invalidFee) => {
        await expect(
          service.updatePlatformFeeBps(invalidFee),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
      },
    );

    it('accepts the boundary values 0 and 10000', async () => {
      prisma.platformSetting.upsert.mockResolvedValue({
        id: PLATFORM_SETTING_ID,
        platformFeeBps: 0,
      });
      await expect(service.updatePlatformFeeBps(0)).resolves.toEqual({
        platformFeeBps: 0,
      });

      prisma.platformSetting.upsert.mockResolvedValue({
        id: PLATFORM_SETTING_ID,
        platformFeeBps: 10_000,
      });
      await expect(service.updatePlatformFeeBps(10_000)).resolves.toEqual({
        platformFeeBps: 10_000,
      });
    });
  });

  describe('publisherShareOf', () => {
    it('computes the publisher share at the default 20% fee', () => {
      expect(service.publisherShareOf(10, 2000).toString()).toBe('8');
    });

    it('returns the full amount at a 0% fee', () => {
      expect(service.publisherShareOf(5.5, 0).toString()).toBe('5.5');
    });

    it('returns zero at a 100% fee', () => {
      expect(service.publisherShareOf(5.5, 10_000).toString()).toBe('0');
    });

    it('rounds to 2 decimal places (half up) for WalletManager compatibility', () => {
      // $1 at a 0.01% fee -> $0.9999 raw -> rounds half-up to $1.00.
      expect(service.publisherShareOf(1, 1).toString()).toBe('1');
      // $0.01 at an 89.95% fee -> $0.001005 raw -> rounds down to $0.00.
      expect(service.publisherShareOf(0.01, 8_995).toString()).toBe('0');
    });
  });
});
