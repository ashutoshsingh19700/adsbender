import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

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
import { ClickHouseTrafficIngestionWorkerService } from './clickhouse-traffic-ingestion-worker.service';

const createEvent = (index: number): TrafficEvent => ({
  type: 'traffic',
  stage: 'click',
  outcome: 'blocked',
  reason: 'CLICK_VELOCITY_EXCEEDED',
  zone: '42',
  campaign: `campaign-${index}`,
  advertiser: 'advertiser-1',
  time: 1719274200 + index,
  request: {
    origin: 'https://publisher.test',
    path: '/article',
    country: 'US',
    device: 'mobile',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 Mobile',
  },
});

describe('ClickHouseTrafficIngestionWorkerService', () => {
  let service: ClickHouseTrafficIngestionWorkerService;
  let consumer: jest.Mocked<MessageBrokerConsumer>;
  let analyticsStore: jest.Mocked<AnalyticsEventStore>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    process.env.CLICKHOUSE_INGESTION_ENABLED = 'true';
    consumer = {
      readBatch: jest.fn(),
      acknowledge: jest.fn(),
    };
    analyticsStore = {
      ensureSchema: jest.fn(),
      insertImpressions: jest.fn(),
      insertClicks: jest.fn(),
      insertTrafficEvents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClickHouseTrafficIngestionWorkerService,
        {
          provide: MESSAGE_BROKER_CONSUMER,
          useValue: consumer,
        },
        {
          provide: ANALYTICS_EVENT_STORE,
          useValue: analyticsStore,
        },
      ],
    }).compile();

    service = module.get(ClickHouseTrafficIngestionWorkerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CLICKHOUSE_INGESTION_ENABLED;
  });

  it('reads traffic messages, bulk inserts them, then acknowledges processed IDs', async () => {
    const messages = [
      { id: '1719274200-0', payload: createEvent(0) },
      { id: '1719274200-1', payload: createEvent(1) },
    ];
    consumer.readBatch.mockResolvedValue(messages);

    await expect(service.processNextBatch()).resolves.toEqual({
      inserted: 2,
    });

    expect(consumer.readBatch).toHaveBeenCalledWith(
      TRAFFIC_EVENTS_CHANNEL,
      '0-0',
      CLICKHOUSE_INGESTION_BATCH_SIZE,
      CLICKHOUSE_INGESTION_BLOCK_MS,
    );
    expect(analyticsStore.insertTrafficEvents).toHaveBeenCalledTimes(1);
    expect(analyticsStore.insertTrafficEvents).toHaveBeenCalledWith(
      messages.map((message) => message.payload),
    );
    expect(consumer.acknowledge).toHaveBeenCalledWith(
      TRAFFIC_EVENTS_CHANNEL,
      messages.map((message) => message.id),
    );
  });

  it('does not insert analytics when ClickHouse ingestion is disabled, but still acknowledges', async () => {
    process.env.CLICKHOUSE_INGESTION_ENABLED = 'false';
    const message = { id: '1719274200-0', payload: createEvent(0) };
    consumer.readBatch.mockResolvedValue([message]);

    await expect(service.processNextBatch()).resolves.toEqual({
      inserted: 1,
    });

    expect(analyticsStore.insertTrafficEvents).not.toHaveBeenCalled();
    expect(consumer.acknowledge).toHaveBeenCalledWith(TRAFFIC_EVENTS_CHANNEL, [
      message.id,
    ]);
  });

  it('does not acknowledge messages if ClickHouse traffic insertion fails', async () => {
    consumer.readBatch.mockResolvedValue([
      { id: '1719274200-0', payload: createEvent(0) },
    ]);
    analyticsStore.insertTrafficEvents.mockRejectedValue(
      new Error('ClickHouse unavailable'),
    );

    await expect(service.processNextBatch()).rejects.toThrow(
      'ClickHouse unavailable',
    );
    expect(consumer.acknowledge).not.toHaveBeenCalled();
  });

  it('returns zero inserted when there are no pending messages', async () => {
    consumer.readBatch.mockResolvedValue([]);

    await expect(service.processNextBatch()).resolves.toEqual({
      inserted: 0,
    });
  });

  it('initializes the ClickHouse schema only when ingestion is enabled', async () => {
    consumer.readBatch.mockResolvedValue([]);

    await service.onModuleInit();
    service.onModuleDestroy();

    expect(analyticsStore.ensureSchema).toHaveBeenCalledTimes(1);
  });

  it('skips schema initialization when ingestion is explicitly disabled, but still starts the loop', async () => {
    process.env.CLICKHOUSE_INGESTION_ENABLED = 'false';
    consumer.readBatch.mockResolvedValue([]);

    await service.onModuleInit();
    service.onModuleDestroy();

    expect(analyticsStore.ensureSchema).not.toHaveBeenCalled();
  });
});
