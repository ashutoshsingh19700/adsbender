import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import type { ImpressionDedupStore } from './impression-dedup.types';
import { RedisRespClient } from './redis-resp.client';
import { resolveRedisConnectionOptions } from '../config/env';

@Injectable()
export class RedisImpressionDedupStore
  implements ImpressionDedupStore, OnModuleDestroy
{
  private readonly logger = new Logger(RedisImpressionDedupStore.name);

  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  // `SET key 1 NX EX ttl` is a single atomic claim: it only succeeds (`OK`)
  // when the key didn't already exist, so two concurrent requests for the
  // same IP/site racing each other can never both "win" a unique impression
  // for the same window.
  async claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
    // Fails OPEN (treat as a fresh/unique claim) rather than throwing - this
    // runs on every single /serve request, and a Redis outage must not stop
    // ad serving. The cost of failing open is a brief window of over-counted
    // "unique" publisher impressions during the outage, which is far
    // cheaper than losing every impression (or every publisher's earnings)
    // for that same window - same tradeoff RedisVelocityCounterStore makes.
    try {
      const result = await this.redis.command<string | null>([
        'SET',
        key,
        '1',
        'NX',
        'EX',
        ttlSeconds,
      ]);

      return result === 'OK';
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for impression dedup claim "${key}" - failing open (treating as unique): ${(error as Error).message}`,
      );
      return true;
    }
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
