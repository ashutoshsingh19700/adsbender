import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { BlacklistCacheStore } from './blacklist-cache.types';
import { RedisRespClient } from './redis-resp.client';
import { resolveRedisConnectionOptions } from '../config/env';

export const BLACKLISTED_IPS_SET_KEY = 'adengine:blacklisted_ips';
const BLACKLISTED_IPS_STAGING_KEY = `${BLACKLISTED_IPS_SET_KEY}:staging`;

// Mirrors RedisZoneCacheStore's staging-key + atomic RENAME pattern - see
// that file for the fuller reasoning on why a direct DEL-then-SADD on the
// live key isn't used here either.
@Injectable()
export class RedisBlacklistCacheStore
  implements BlacklistCacheStore, OnModuleDestroy
{
  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  async replaceBlacklistedIps(ipAddresses: string[]) {
    await this.redis.command(['DEL', BLACKLISTED_IPS_STAGING_KEY]);

    if (ipAddresses.length === 0) {
      await this.redis.command(['DEL', BLACKLISTED_IPS_SET_KEY]);
      return;
    }

    await this.redis.command([
      'SADD',
      BLACKLISTED_IPS_STAGING_KEY,
      ...ipAddresses,
    ]);
    await this.redis.command([
      'RENAME',
      BLACKLISTED_IPS_STAGING_KEY,
      BLACKLISTED_IPS_SET_KEY,
    ]);
  }

  async isBlacklisted(ipAddress: string): Promise<boolean> {
    const result = await this.redis.command<number>([
      'SISMEMBER',
      BLACKLISTED_IPS_SET_KEY,
      ipAddress,
    ]);

    return result === 1;
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
