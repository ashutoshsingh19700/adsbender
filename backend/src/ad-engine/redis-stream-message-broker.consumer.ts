import { Injectable, OnModuleDestroy } from '@nestjs/common';

import type {
  AdEvent,
  BrokerMessage,
  MessageBrokerConsumer,
} from './ad-event.types';
import { RedisRespClient } from './redis-resp.client';

type RedisStreamResponse = [string, Array<[string, string[]]>][];

@Injectable()
export class RedisStreamMessageBrokerConsumer
  implements MessageBrokerConsumer, OnModuleDestroy
{
  private readonly redis = new RedisRespClient({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
    timeoutMs: Number(process.env.REDIS_STREAM_READ_TIMEOUT_MS ?? 7000),
  });

  async readBatch(
    channel: string,
    lastMessageId: string,
    count: number,
    blockMs: number,
  ): Promise<BrokerMessage<AdEvent>[]> {
    const response = await this.redis.command<RedisStreamResponse | null>([
      'XREAD',
      'COUNT',
      count,
      'BLOCK',
      blockMs,
      'STREAMS',
      channel,
      lastMessageId,
    ]);

    if (!response) {
      return [];
    }

    return this.parseStreamResponse(response);
  }

  async acknowledge(channel: string, messageIds: string[]) {
    if (messageIds.length === 0) {
      return;
    }

    await this.redis.command(['XDEL', channel, ...messageIds]);
  }

  onModuleDestroy() {
    this.redis.destroy();
  }

  private parseStreamResponse(
    response: RedisStreamResponse,
  ): BrokerMessage<AdEvent>[] {
    const messages: BrokerMessage<AdEvent>[] = [];

    for (const [, entries] of response) {
      for (const [id, fields] of entries) {
        const payloadIndex = fields.indexOf('payload');

        if (payloadIndex === -1) {
          continue;
        }

        messages.push({
          id,
          payload: JSON.parse(fields[payloadIndex + 1]) as AdEvent,
        });
      }
    }

    return messages;
  }
}
