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
import { CpmBillingService } from './cpm-billing.service';
import { isSingletonWorker } from '../common/cluster-worker';

export const MESSAGE_BROKER_CONSUMER = Symbol('MESSAGE_BROKER_CONSUMER');
export const ANALYTICS_EVENT_STORE = Symbol('ANALYTICS_EVENT_STORE');
export const CLICKHOUSE_INGESTION_BATCH_SIZE = 2_000;
// Each idle XREAD BLOCK call is billed as one Redis command by Upstash
// regardless of how long it blocks, so this interval directly controls
// idle-polling command volume: at 1s, 3 workers idling 24/7 burn ~260k
// commands/day on their own (most of the 500k/month free-tier quota). At
// 60s that drops to ~4.3k/day (~130k/month), leaving headroom for real
// traffic. A live event still wakes XREAD immediately regardless of this
// value - it only bounds the worst-case idle gap.
export const CLICKHOUSE_INGESTION_BLOCK_MS = Number(
  process.env.CLICKHOUSE_INGESTION_BLOCK_MS ?? 60_000,
);

// Also the only consumer of adengine:events:impressions (same hard-XDEL
// reasoning as ClickHouseClickIngestionWorkerService's comment on the
// clicks channel), which is why CPM billing (CpmBillingService) lives in
// here rather than as a separate worker - see processNextBatch. Billing
// must run even when ClickHouse itself is disabled/down, so the loop and
// the billing step run unconditionally now - only the analytics insert
// stays gated on CLICKHOUSE_INGESTION_ENABLED.
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
    private readonly cpmBillingService: CpmBillingService,
  ) {}

  // See cluster-worker.ts - this is the only allowed reader of
  // adengine:events:impressions (plain XREAD, no consumer group), so under
  // cluster mode only the designated singleton worker actually runs the
  // loop; every other worker's instance of this service stays inert.
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

    // Bill first: money movement must happen regardless of whether
    // ClickHouse analytics insertion is enabled or succeeds.
    // recordImpression never throws for a CPC event (event.maxCpm unset -
    // it's a no-op), and any error for a real CPM event is caught inside
    // AdBillingService/CpmBillingService and logged, not propagated, so one
    // unbillable event can't stall the batch.
    for (const event of events) {
      await this.cpmBillingService.recordImpression(event);
    }

    if (this.clickHouseEnabled()) {
      await this.flush(events);
    }

    await this.messageBrokerConsumer.acknowledge(
      IMPRESSION_EVENTS_CHANNEL,
      messages.map((message) => message.id),
    );
    this.lastMessageId = messages[messages.length - 1].id;

    return {
      inserted: events.length,
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
