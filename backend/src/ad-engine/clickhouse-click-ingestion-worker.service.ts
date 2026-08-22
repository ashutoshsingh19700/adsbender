import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { AdBillingService } from './ad-billing.service';
import { CLICK_EVENTS_CHANNEL } from './ad-event-producer.service';
import type {
  AnalyticsEventStore,
  ClickEvent,
  MessageBrokerConsumer,
} from './ad-event.types';
import {
  ANALYTICS_EVENT_STORE,
  CLICKHOUSE_INGESTION_BATCH_SIZE,
  CLICKHOUSE_INGESTION_BLOCK_MS,
  MESSAGE_BROKER_CONSUMER,
} from './clickhouse-ingestion-worker.service';

// This is also the only consumer of adengine:events:clicks, and the only
// one that ever can be: RedisStreamMessageBrokerConsumer.acknowledge does a
// hard XDEL rather than a consumer-group ack, so a second independent
// reader of the same channel would race this one for messages instead of
// getting its own copy. That's why click billing (AdBillingService) lives
// in here rather than as a separate worker - see billClick's call site
// below. Billing must run even when ClickHouse itself is disabled/down, so
// only the analytics insert - not the loop or the billing step - is gated
// on CLICKHOUSE_INGESTION_ENABLED.
@Injectable()
export class ClickHouseClickIngestionWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    ClickHouseClickIngestionWorkerService.name,
  );
  private running = false;
  private lastMessageId = '0-0';

  constructor(
    @Inject(MESSAGE_BROKER_CONSUMER)
    private readonly messageBrokerConsumer: MessageBrokerConsumer,
    @Inject(ANALYTICS_EVENT_STORE)
    private readonly analyticsEventStore: AnalyticsEventStore,
    private readonly adBillingService: AdBillingService,
  ) {}

  onModuleInit() {
    this.running = true;
    void this.runLoop();
  }

  onModuleDestroy() {
    this.running = false;
  }

  async processNextBatch() {
    const messages = await this.messageBrokerConsumer.readBatch(
      CLICK_EVENTS_CHANNEL,
      this.lastMessageId,
      CLICKHOUSE_INGESTION_BATCH_SIZE,
      CLICKHOUSE_INGESTION_BLOCK_MS,
    );

    if (messages.length === 0) {
      return {
        inserted: 0,
      };
    }

    // Bill first: money movement must happen regardless of whether
    // ClickHouse analytics insertion is enabled or succeeds. billClick
    // never throws (see its own doc comment), so one unbillable event can't
    // stall the batch.
    for (const message of messages) {
      await this.adBillingService.billClick(
        message.payload as ClickEvent,
        message.id,
      );
    }

    if (this.clickHouseEnabled()) {
      const events = messages.map((message) => message.payload as ClickEvent);
      await this.flush(events);
    }

    await this.messageBrokerConsumer.acknowledge(
      CLICK_EVENTS_CHANNEL,
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
        this.logger.error('ClickHouse click ingestion batch failed', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async flush(events: ClickEvent[]) {
    for (
      let index = 0;
      index < events.length;
      index += CLICKHOUSE_INGESTION_BATCH_SIZE
    ) {
      await this.analyticsEventStore.insertClicks(
        events.slice(index, index + CLICKHOUSE_INGESTION_BATCH_SIZE),
      );
    }
  }
}
