import { Injectable, OnModuleDestroy } from '@nestjs/common';

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
  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  async increment(
    key: string,
    ttlSeconds: number,
  ): Promise<VelocityCounterResult> {
    const count = await this.redis.command<number>(['INCR', key]);

    if (count === 1) {
      await this.redis.command(['EXPIRE', key, ttlSeconds]);
    }

    return {
      key,
      count,
      ttlSeconds,
    };
  }

  // Reads a counter without incrementing it - a missing key (nothing
  // recorded yet, or its TTL already expired) comes back as Redis nil,
  // which means "zero", not "error".
  async get(key: string): Promise<number> {
    const value = await this.redis.command<string | null>(['GET', key]);

    return value === null ? 0 : Number(value);
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
