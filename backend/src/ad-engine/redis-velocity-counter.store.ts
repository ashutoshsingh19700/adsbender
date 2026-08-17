import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { RedisRespClient } from './redis-resp.client';
import type {
  VelocityCounterResult,
  VelocityCounterStore,
} from './velocity-cap.types';

@Injectable()
export class RedisVelocityCounterStore
  implements VelocityCounterStore, OnModuleDestroy
{
  private readonly redis = new RedisRespClient({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
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

  onModuleDestroy() {
    this.redis.destroy();
  }
}
