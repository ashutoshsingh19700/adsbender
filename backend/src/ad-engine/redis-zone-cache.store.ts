import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import type { CacheableZone, ZoneCacheRecord, ZoneCacheStore } from './zone-cache.types';
import { RedisRespClient } from './redis-resp.client';
import { resolveRedisConnectionOptions } from '../config/env';

export const ACTIVE_ZONES_KEY = 'adengine:active_zones';

// Whole active-zone list as a single JSON blob under one key (1 Redis
// command either way) instead of a membership set plus one layoutType hash
// per zone (2 + N commands on every sync, 2 commands on every /serve read) -
// same reasoning/pattern as RedisCampaignCacheStore. That older per-zone
// version billed a SMEMBERS + up-to-N DEL + DEL + SADD + RENAME + N*HSET
// every 30s sync regardless of whether anything changed, which is what ran
// the Redis command quota dry with near-zero real traffic.
@Injectable()
export class RedisZoneCacheStore implements ZoneCacheStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisZoneCacheStore.name);

  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  async replaceActiveZoneIds(zones: CacheableZone[]) {
    await this.redis.command(['SET', ACTIVE_ZONES_KEY, JSON.stringify(zones)]);
  }

  async getActiveZone(zoneId: string): Promise<ZoneCacheRecord | null> {
    // Fails to null (zone treated as not found -> /serve responds with "no
    // ad", not a 500) rather than throwing - this is called on every single
    // /serve request. See RedisVelocityCounterStore for the fuller
    // reasoning.
    try {
      const raw = await this.redis.command<string | null>([
        'GET',
        ACTIVE_ZONES_KEY,
      ]);

      if (!raw) {
        return null;
      }

      const zones = JSON.parse(raw) as CacheableZone[];
      const zone = zones.find((candidate) => candidate.id === zoneId);

      return zone ? { layoutType: zone.layoutType } : null;
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for zone cache lookup on "${zoneId}" - reporting not found: ${(error as Error).message}`,
      );
      return null;
    }
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
