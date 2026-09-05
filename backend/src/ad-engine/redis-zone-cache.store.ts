import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { RedisRespClient } from './redis-resp.client';
import { ZoneCacheStore } from './zone-cache.types';

export const ACTIVE_ZONES_SET_KEY = 'adengine:active_zones';
const ACTIVE_ZONES_STAGING_KEY = `${ACTIVE_ZONES_SET_KEY}:staging`;

@Injectable()
export class RedisZoneCacheStore implements ZoneCacheStore, OnModuleDestroy {
  private readonly redis = new RedisRespClient({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
  });

  // Every /serve request calls isActiveZone (see AdTargetingService) -
  // builds the new set under a staging key and RENAMEs it into place
  // atomically, rather than DEL-then-SADD directly on the live key, so a
  // request racing a sync never sees an empty set (which would make every
  // zone briefly look inactive and reject legitimate ad requests).
  async replaceActiveZoneIds(zoneIds: string[]) {
    await this.redis.command(['DEL', ACTIVE_ZONES_STAGING_KEY]);

    if (zoneIds.length === 0) {
      // Nothing to RENAME into place - just clear the live set directly,
      // there's no "briefly empty" race to avoid when the target state
      // actually is empty.
      await this.redis.command(['DEL', ACTIVE_ZONES_SET_KEY]);
      return;
    }

    await this.redis.command(['SADD', ACTIVE_ZONES_STAGING_KEY, ...zoneIds]);
    await this.redis.command([
      'RENAME',
      ACTIVE_ZONES_STAGING_KEY,
      ACTIVE_ZONES_SET_KEY,
    ]);
  }

  async isActiveZone(zoneId: string): Promise<boolean> {
    const result = await this.redis.command<number>([
      'SISMEMBER',
      ACTIVE_ZONES_SET_KEY,
      zoneId,
    ]);

    return result === 1;
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
