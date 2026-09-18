import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { TRAFFIC_EVENTS_CHANNEL } from './ad-event-producer.service';
import type {
  AnalyticsEventStore,
  MessageBrokerConsumer,
  TrafficEvent,
} from './ad-event.types';
import {
  ANALYTICS_EVENT_STORE,
  CLICKHOUSE_INGESTION_BATCH_SIZE,
  CLICKHOUSE_INGESTION_BLOCK_MS,
  MESSAGE_BROKER_CONSUMER,
} from './clickhouse-ingestion-worker.service';
import { isSingletonWorker } from '../common/cluster-worker';

// Same one-consumer-per-channel constraint as the impression/click workers
// (RedisStreamMessageBrokerConsumer.acknowledge does a hard XDEL - see the
// click worker's comment), hence its own channel and its own worker rather
// than piggybacking on either of them. No billing step here - traffic
// events are never billable, only ever analytics.
@Injectable()
export class ClickHouseTrafficIngestionWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    ClickHouseTrafficIngestionWorkerService.name,
  );
  private running = false;
  private lastMessageId = '0-0';

  constructor(
    @Inject(MESSAGE_BROKER_CONSUMER)
    private readonly messageBrokerConsumer: MessageBrokerConsumer,
    @Inject(ANALYTICS_EVENT_STORE)
    private readonly analyticsEventStore: AnalyticsEventStore,
  ) {}

  // See cluster-worker.ts / clickhouse-ingestion-worker.service.ts's own
  // comment - only the designated singleton worker may read this stream.
  onModuleInit() {
    if (!isSingletonWorker()) {
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
      TRAFFIC_EVENTS_CHANNEL,
      this.lastMessageId,
      CLICKHOUSE_INGESTION_BATCH_SIZE,
      CLICKHOUSE_INGESTION_BLOCK_MS,
    );

    if (messages.length === 0) {
      return {
        inserted: 0,
      };
    }

    if (this.clickHouseEnabled()) {
      const events = messages.map(
        (message) => message.payload as TrafficEvent,
      );
      await this.flush(events);
    }

    await this.messageBrokerConsumer.acknowledge(
      TRAFFIC_EVENTS_CHANNEL,
      messages.map((message) => message.id),
    );
    this.lastMessageId = messages[messages.length - 1].id;

    return {
      inserted: messages.length,
    };
  }

  private clickHouseEnabled(): boolean {
    return process.env.CLICKHOUSE_INGESTION_ENABLED !== 'false';
  }

  private async runLoop() {
    if (this.clickHouseEnabled()) {
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
    }

    while (this.running) {
      try {
        await this.processNextBatch();
      } catch (error) {
        this.logger.error('ClickHouse traffic ingestion batch failed', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async flush(events: TrafficEvent[]) {
    for (
      let index = 0;
      index < events.length;
      index += CLICKHOUSE_INGESTION_BATCH_SIZE
    ) {
      await this.analyticsEventStore.insertTrafficEvents(
        events.slice(index, index + CLICKHOUSE_INGESTION_BATCH_SIZE),
      );
    }
  }
}
