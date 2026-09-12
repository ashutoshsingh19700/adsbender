import { Injectable, OnModuleDestroy } from '@nestjs/common';

import type { AdEvent, MessageBrokerPublisher } from './ad-event.types';
import { RedisRespClient } from './redis-resp.client';
import { resolveRedisConnectionOptions } from '../config/env';

@Injectable()
export class RedisStreamMessageBrokerPublisher
  implements MessageBrokerPublisher, OnModuleDestroy
{
  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  async publish(channel: string, payload: AdEvent) {
    await this.redis.command([
      'XADD',
      channel,
      '*',
      'payload',
      JSON.stringify(payload),
    ]);
  }

  onModuleDestroy() {
    this.redis.destroy();
  }
}
