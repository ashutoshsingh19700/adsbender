import { Test, TestingModule } from '@nestjs/testing';

import { ZONE_CACHE_STORE, ZoneCacheSyncService } from './zone-cache-sync.service';
import { ZoneCacheStore } from './zone-cache.types';
import { PrismaService } from '../prisma/prisma.service';

describe('ZoneCacheSyncService', () => {
  let service: ZoneCacheSyncService;
  let prismaService: {
    adZone: { findMany: jest.Mock };
  };
  let zoneCacheStore: jest.Mocked<ZoneCacheStore>;

  beforeEach(async () => {
    prismaService = {
      adZone: { findMany: jest.fn() },
    };
    zoneCacheStore = {
      replaceActiveZoneIds: jest.fn(),
      getActiveZone: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZoneCacheSyncService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: ZONE_CACHE_STORE,
          useValue: zoneCacheStore,
        },
      ],
    }).compile();

    service = module.get(ZoneCacheSyncService);
  });

  it('loads ACTIVE zone ids and layout types into the Redis cache store', async () => {
    prismaService.adZone.findMany.mockResolvedValue([
      { id: 'zone-1', layoutType: 'MEDIUM_RECTANGLE_300X250' },
      { id: 'zone-2', layoutType: 'POPUP' },
    ]);

    await expect(service.syncActiveZones()).resolves.toEqual({
      cachedZones: 2,
    });

    expect(prismaService.adZone.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      select: { id: true, layoutType: true },
    });
    expect(zoneCacheStore.replaceActiveZoneIds).toHaveBeenCalledWith([
      { id: 'zone-1', layoutType: 'MEDIUM_RECTANGLE_300X250' },
      { id: 'zone-2', layoutType: 'POPUP' },
    ]);
  });

  it('removes a paused zone from Redis on the next sync by replacing with an empty active list', async () => {
    prismaService.adZone.findMany.mockResolvedValue([]);

    await expect(service.syncActiveZones()).resolves.toEqual({
      cachedZones: 0,
    });

    expect(zoneCacheStore.replaceActiveZoneIds).toHaveBeenCalledWith([]);
  });
});
