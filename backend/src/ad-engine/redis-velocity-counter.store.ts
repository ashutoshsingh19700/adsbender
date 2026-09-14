import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { RedisRespClient } from './redis-resp.client';
import { resolveRedisConnectionOptions } from '../config/env';
import type {
  FrequencyCapCounterStore,
  VelocityCounterResult,
} from './velocity-cap.types';

@Injectable()
export class RedisVelocityCounterStore
  implements FrequencyCapCounterStore, OnModuleDestroy
{
  private readonly logger = new Logger(RedisVelocityCounterStore.name);

  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  async increment(
    key: string,
    ttlSeconds: number,
  ): Promise<VelocityCounterResult> {
    // Fails OPEN (treat as "no prior hits this window") rather than
    // throwing - this runs on every single /serve and /click, so a Redis
    // outage/quota exhaustion must not take down all ad serving just to
    // enforce a velocity cap. Losing frequency-capping during an outage is
    // far cheaper than losing every impression/click. See also
    // RedisBlacklistCacheStore/RedisCampaignCacheStore/RedisZoneCacheStore,
    // hardened the same way.
    try {
      const count = await this.redis.command<number>(['INCR', key]);

      if (count === 1) {
        await this.redis.command(['EXPIRE', key, ttlSeconds]);
      }

      return {
        key,
        count,
        ttlSeconds,
      };
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for velocity counter "${key}" - failing open (allowing): ${(error as Error).message}`,
      );
      return { key, count: 0, ttlSeconds };
    }
  }

  // Reads a counter without incrementing it - a missing key (nothing
  // recorded yet, or its TTL already expired) comes back as Redis nil,
  // which means "zero", not "error".
  async get(key: string): Promise<number> {
    try {
      const value = await this.redis.command<string | null>(['GET', key]);

      return value === null ? 0 : Number(value);
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for velocity counter "${key}" - reporting 0: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
