import { Test, TestingModule } from '@nestjs/testing';

import {
  BLACKLIST_CACHE_STORE,
  BlacklistCacheSyncService,
} from './blacklist-cache-sync.service';
import { BlacklistCacheStore } from './blacklist-cache.types';
import { PrismaService } from '../prisma/prisma.service';

describe('BlacklistCacheSyncService', () => {
  let service: BlacklistCacheSyncService;
  let prismaService: {
    blacklistedIp: { findMany: jest.Mock };
  };
  let blacklistCacheStore: jest.Mocked<BlacklistCacheStore>;

  beforeEach(async () => {
    prismaService = {
      blacklistedIp: { findMany: jest.fn() },
    };
    blacklistCacheStore = {
      replaceBlacklistedIps: jest.fn(),
      isBlacklisted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlacklistCacheSyncService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: BLACKLIST_CACHE_STORE,
          useValue: blacklistCacheStore,
        },
      ],
    }).compile();

    service = module.get(BlacklistCacheSyncService);
  });

  it('loads every blacklisted IP into the Redis cache store', async () => {
    prismaService.blacklistedIp.findMany.mockResolvedValue([
      { ipAddress: '1.2.3.4' },
      { ipAddress: '5.6.7.8' },
    ]);

    await expect(service.syncBlacklistedIps()).resolves.toEqual({
      cachedIps: 2,
    });

    expect(prismaService.blacklistedIp.findMany).toHaveBeenCalledWith({
      select: { ipAddress: true },
    });
    expect(blacklistCacheStore.replaceBlacklistedIps).toHaveBeenCalledWith([
      '1.2.3.4',
      '5.6.7.8',
    ]);
  });

  it('clears a removed IP from Redis on the next sync by replacing with an empty list', async () => {
    prismaService.blacklistedIp.findMany.mockResolvedValue([]);

    await expect(service.syncBlacklistedIps()).resolves.toEqual({
      cachedIps: 0,
    });

    expect(blacklistCacheStore.replaceBlacklistedIps).toHaveBeenCalledWith([]);
  });
});
