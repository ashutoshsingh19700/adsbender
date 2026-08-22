import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

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
import { ClickHouseClickIngestionWorkerService } from './clickhouse-click-ingestion-worker.service';

const createEvent = (index: number): ClickEvent => ({
  type: 'click',
  zone: '42',
  campaign: `campaign-${index}`,
  advertiser: 'advertiser-1',
  cost: 0.001,
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

describe('ClickHouseClickIngestionWorkerService', () => {
  let service: ClickHouseClickIngestionWorkerService;
  let consumer: jest.Mocked<MessageBrokerConsumer>;
  let analyticsStore: jest.Mocked<AnalyticsEventStore>;
  let adBillingService: jest.Mocked<AdBillingService>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    // Importing @prisma/client (transitively, via AdBillingService ->
    // WalletManager -> PrismaService) auto-loads backend/.env, which sets
    // CLICKHOUSE_INGESTION_ENABLED=false as an ambient side effect - pin an
    // explicit baseline here instead of relying on the var being unset, so
    // these tests don't depend on that load having happened yet.
    process.env.CLICKHOUSE_INGESTION_ENABLED = 'true';
    consumer = {
      readBatch: jest.fn(),
      acknowledge: jest.fn(),
    };
    analyticsStore = {
      ensureSchema: jest.fn(),
      insertImpressions: jest.fn(),
      insertClicks: jest.fn(),
    };
    adBillingService = {
      billClick: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AdBillingService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClickHouseClickIngestionWorkerService,
        {
          provide: MESSAGE_BROKER_CONSUMER,
          useValue: consumer,
        },
        {
          provide: ANALYTICS_EVENT_STORE,
          useValue: analyticsStore,
        },
        {
          provide: AdBillingService,
          useValue: adBillingService,
        },
      ],
    }).compile();

    service = module.get(ClickHouseClickIngestionWorkerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CLICKHOUSE_INGESTION_ENABLED;
  });

  it('reads up to 2,000 click messages, bulk inserts them, then acknowledges processed IDs', async () => {
    const messages = Array.from({ length: 2000 }, (_, index) => ({
      id: `1719274200-${index}`,
      payload: createEvent(index),
    }));
    consumer.readBatch.mockResolvedValue(messages);

    await expect(service.processNextBatch()).resolves.toEqual({
      inserted: 2000,
    });

    expect(consumer.readBatch).toHaveBeenCalledWith(
      CLICK_EVENTS_CHANNEL,
      '0-0',
      CLICKHOUSE_INGESTION_BATCH_SIZE,
      CLICKHOUSE_INGESTION_BLOCK_MS,
    );
    expect(adBillingService.billClick).toHaveBeenCalledTimes(2000);
    expect(adBillingService.billClick).toHaveBeenNthCalledWith(
      1,
      messages[0].payload,
      messages[0].id,
    );
    expect(analyticsStore.insertClicks).toHaveBeenCalledTimes(1);
    expect(analyticsStore.insertClicks).toHaveBeenCalledWith(
      messages.map((message) => message.payload),
    );
    expect(consumer.acknowledge).toHaveBeenCalledWith(
      CLICK_EVENTS_CHANNEL,
      messages.map((message) => message.id),
    );
  });

  it('bills every click even when ClickHouse ingestion is disabled, without inserting analytics', async () => {
    process.env.CLICKHOUSE_INGESTION_ENABLED = 'false';
    const message = { id: '1719274200-0', payload: createEvent(0) };
    consumer.readBatch.mockResolvedValue([message]);

    await expect(service.processNextBatch()).resolves.toEqual({
      inserted: 1,
    });

    expect(adBillingService.billClick).toHaveBeenCalledWith(
      message.payload,
      message.id,
    );
    expect(analyticsStore.insertClicks).not.toHaveBeenCalled();
    expect(consumer.acknowledge).toHaveBeenCalledWith(CLICK_EVENTS_CHANNEL, [
      message.id,
    ]);
  });

  it('does not let one failing billClick call stop the rest of the batch from being billed or acknowledged', async () => {
    const messages = [
      { id: '1719274200-0', payload: createEvent(0) },
      { id: '1719274200-1', payload: createEvent(1) },
    ];
    consumer.readBatch.mockResolvedValue(messages);
    // billClick's real implementation never throws (it logs and swallows
    // internally) - this just proves the worker doesn't add its own
    // assumption that every call resolves in the same way.
    adBillingService.billClick
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await expect(service.processNextBatch()).resolves.toEqual({
      inserted: 2,
    });
    expect(adBillingService.billClick).toHaveBeenCalledTimes(2);
    expect(consumer.acknowledge).toHaveBeenCalledWith(
      CLICK_EVENTS_CHANNEL,
      messages.map((m) => m.id),
    );
  });

  it('does not acknowledge messages if ClickHouse click insertion fails', async () => {
    consumer.readBatch.mockResolvedValue([
      {
        id: '1719274200-0',
        payload: createEvent(0),
      },
    ]);
    analyticsStore.insertClicks.mockRejectedValue(
      new Error('ClickHouse unavailable'),
    );

    await expect(service.processNextBatch()).rejects.toThrow(
      'ClickHouse unavailable',
    );
    expect(consumer.acknowledge).not.toHaveBeenCalled();
  });

  it('initializes the ClickHouse schema only when ingestion is enabled', async () => {
    consumer.readBatch.mockResolvedValue([]);

    await service.onModuleInit();
    service.onModuleDestroy();

    expect(analyticsStore.ensureSchema).toHaveBeenCalledTimes(1);
  });

  it('skips schema initialization when ingestion is explicitly disabled, but still starts the (billing) loop', async () => {
    process.env.CLICKHOUSE_INGESTION_ENABLED = 'false';
    consumer.readBatch.mockResolvedValue([]);

    await service.onModuleInit();
    service.onModuleDestroy();

    expect(analyticsStore.ensureSchema).not.toHaveBeenCalled();
  });
});
