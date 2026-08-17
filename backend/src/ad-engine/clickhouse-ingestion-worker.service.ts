import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { IMPRESSION_EVENTS_CHANNEL } from './ad-event-producer.service';
import type {
  AnalyticsEventStore,
  ImpressionEvent,
  MessageBrokerConsumer,
} from './ad-event.types';

export const MESSAGE_BROKER_CONSUMER = Symbol('MESSAGE_BROKER_CONSUMER');
export const ANALYTICS_EVENT_STORE = Symbol('ANALYTICS_EVENT_STORE');
export const CLICKHOUSE_INGESTION_BATCH_SIZE = 2_000;
export const CLICKHOUSE_INGESTION_BLOCK_MS = 1_000;

@Injectable()
export class ClickHouseIngestionWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ClickHouseIngestionWorkerService.name);
  private running = false;
  private lastMessageId = '0-0';

  constructor(
    @Inject(MESSAGE_BROKER_CONSUMER)
    private readonly messageBrokerConsumer: MessageBrokerConsumer,
    @Inject(ANALYTICS_EVENT_STORE)
    private readonly analyticsEventStore: AnalyticsEventStore,
  ) {}

  onModuleInit() {
    if (process.env.CLICKHOUSE_INGESTION_ENABLED === 'false') {
      return;
    }

    this.running = true;
    void this.runLoop();
  }

  onModuleDestroy() {
    this.running = false;
  }

  async processNextBatch() {
    const messages = await this.messageBrokerConsumer.readBatch(
      IMPRESSION_EVENTS_CHANNEL,
      this.lastMessageId,
      CLICKHOUSE_INGESTION_BATCH_SIZE,
      CLICKHOUSE_INGESTION_BLOCK_MS,
    );

    if (messages.length === 0) {
      return {
        inserted: 0,
      };
    }

    const events = messages.map(
      (message) => message.payload as ImpressionEvent,
    );
    await this.flush(events);
    await this.messageBrokerConsumer.acknowledge(
      IMPRESSION_EVENTS_CHANNEL,
      messages.map((message) => message.id),
    );
    this.lastMessageId = messages[messages.length - 1].id;

    return {
      inserted: events.length,
    };
  }

  private async runLoop() {
    while (this.running) {
      try {
        await this.analyticsEventStore.ensureSchema();
        break;
      } catch (error) {
        this.logger.error(
          'ClickHouse schema initialization failed, retrying in 5s',
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    while (this.running) {
      try {
        await this.processNextBatch();
      } catch (error) {
        this.logger.error('ClickHouse ingestion batch failed', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async flush(events: ImpressionEvent[]) {
    for (
      let index = 0;
      index < events.length;
      index += CLICKHOUSE_INGESTION_BATCH_SIZE
    ) {
      await this.analyticsEventStore.insertImpressions(
        events.slice(index, index + CLICKHOUSE_INGESTION_BATCH_SIZE),
      );
    }
  }
}
