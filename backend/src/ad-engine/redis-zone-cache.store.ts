import { Injectable, OnModuleDestroy } from '@nestjs/common';

import type { CacheableZone, ZoneCacheRecord, ZoneCacheStore } from './zone-cache.types';
import { RedisRespClient } from './redis-resp.client';

export const ACTIVE_ZONES_SET_KEY = 'adengine:active_zones';
const ACTIVE_ZONES_STAGING_KEY = `${ACTIVE_ZONES_SET_KEY}:staging`;
export const zoneCacheKey = (zoneId: string) => `adengine:zone:${zoneId}`;

@Injectable()
export class RedisZoneCacheStore implements ZoneCacheStore, OnModuleDestroy {
  private readonly redis = new RedisRespClient({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
  });

  // Every /serve request calls getActiveZone (see AdTargetingService) -
  // builds the new membership set under a staging key and RENAMEs it into
  // place atomically, rather than DEL-then-SADD directly on the live key,
  // so a request racing a sync never sees an empty set (which would make
  // every zone briefly look inactive and reject legitimate ad requests).
  // The per-zone layoutType hash is written after that (same pattern
  // RedisCampaignCacheStore uses) - a request racing THAT step just reads
  // a zone as active with a momentarily-stale/missing layoutType, same
  // staleness budget already accepted for the campaign cache.
  async replaceActiveZoneIds(zones: CacheableZone[]) {
    const zoneIds = zones.map((zone) => zone.id);
    const existingZoneIds =
      (await this.redis.command<string[]>([
        'SMEMBERS',
        ACTIVE_ZONES_SET_KEY,
      ])) ?? [];
    const nextZoneIds = new Set(zoneIds);

    for (const existingZoneId of existingZoneIds) {
      if (!nextZoneIds.has(existingZoneId)) {
        await this.redis.command(['DEL', zoneCacheKey(existingZoneId)]);
      }
    }

    await this.redis.command(['DEL', ACTIVE_ZONES_STAGING_KEY]);

    if (zoneIds.length === 0) {
      // Nothing to RENAME into place - just clear the live set directly,
      // there's no "briefly empty" race to avoid when the target state
      // actually is empty.
      await this.redis.command(['DEL', ACTIVE_ZONES_SET_KEY]);
    } else {
      await this.redis.command(['SADD', ACTIVE_ZONES_STAGING_KEY, ...zoneIds]);
      await this.redis.command([
        'RENAME',
        ACTIVE_ZONES_STAGING_KEY,
        ACTIVE_ZONES_SET_KEY,
      ]);
    }

    for (const zone of zones) {
      await this.redis.command([
        'HSET',
        zoneCacheKey(zone.id),
        'layoutType',
        zone.layoutType,
      ]);
    }
  }

  async getActiveZone(zoneId: string): Promise<ZoneCacheRecord | null> {
    const isMember = await this.redis.command<number>([
      'SISMEMBER',
      ACTIVE_ZONES_SET_KEY,
      zoneId,
    ]);

    if (isMember !== 1) {
      return null;
    }

    const layoutType = await this.redis.command<string | null>([
      'HGET',
      zoneCacheKey(zoneId),
      'layoutType',
    ]);

    return { layoutType: layoutType ?? '' };
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
