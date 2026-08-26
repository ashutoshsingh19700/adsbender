import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AdBillingService } from './ad-billing.service';
import type { ImpressionEvent } from './ad-event.types';
import { CpmBillingService, IMPRESSIONS_PER_CPM_BATCH } from './cpm-billing.service';
import { VELOCITY_COUNTER_STORE } from './frequency-capping.service';
import type { VelocityCounterStore } from './velocity-cap.types';
import { PrismaService } from '../prisma/prisma.service';

const createEvent = (overrides: Partial<ImpressionEvent> = {}): ImpressionEvent => ({
  type: 'impression',
  zone: 'zone-1',
  campaign: 'campaign-1',
  advertiser: 'advertiser-1',
  cost: 0.002,
  time: 1719274200,
  request: {
    origin: 'https://publisher.test',
    path: '/article',
    country: 'US',
    device: 'desktop',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
  },
  maxCpm: 2,
  ...overrides,
});

describe('CpmBillingService', () => {
  let service: CpmBillingService;
  let counterStore: jest.Mocked<VelocityCounterStore>;
  let adBillingService: { billCpmBatch: jest.Mock };
  let prisma: { adZone: { findUnique: jest.Mock } };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    counterStore = { increment: jest.fn() };
    adBillingService = { billCpmBatch: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      adZone: {
        findUnique: jest.fn().mockResolvedValue({ publisherId: 'publisher-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpmBillingService,
        { provide: VELOCITY_COUNTER_STORE, useValue: counterStore },
        { provide: AdBillingService, useValue: adBillingService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CpmBillingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing for a non-CPM event (no maxCpm)', async () => {
    await service.recordImpression(createEvent({ maxCpm: undefined }));

    expect(counterStore.increment).not.toHaveBeenCalled();
    expect(adBillingService.billCpmBatch).not.toHaveBeenCalled();
  });

  it('increments the counter but does not bill before the count reaches a multiple of 1000', async () => {
    counterStore.increment.mockResolvedValue({
      key: 'cpm:count:campaign-1',
      count: 999,
      ttlSeconds: 315_360_000,
    });

    await service.recordImpression(createEvent());

    expect(counterStore.increment).toHaveBeenCalledWith(
      'cpm:count:campaign-1',
      315_360_000,
    );
    expect(adBillingService.billCpmBatch).not.toHaveBeenCalled();
  });

  it(`bills exactly maxCpm once the count reaches ${IMPRESSIONS_PER_CPM_BATCH}`, async () => {
    counterStore.increment.mockResolvedValue({
      key: 'cpm:count:campaign-1',
      count: 1000,
      ttlSeconds: 315_360_000,
    });

    await service.recordImpression(createEvent({ maxCpm: 2 }));

    expect(adBillingService.billCpmBatch).toHaveBeenCalledWith(
      'campaign-1',
      'publisher-1',
      2,
      'cpm:campaign-1:batch:1',
    );
  });

  it('bills again with a new batch number at the second multiple of 1000', async () => {
    counterStore.increment.mockResolvedValue({
      key: 'cpm:count:campaign-1',
      count: 2000,
      ttlSeconds: 315_360_000,
    });

    await service.recordImpression(createEvent({ maxCpm: 2 }));

    expect(adBillingService.billCpmBatch).toHaveBeenCalledWith(
      'campaign-1',
      'publisher-1',
      2,
      'cpm:campaign-1:batch:2',
    );
  });

  it('skips billing (without throwing) when the zone no longer exists', async () => {
    counterStore.increment.mockResolvedValue({
      key: 'cpm:count:campaign-1',
      count: 1000,
      ttlSeconds: 315_360_000,
    });
    prisma.adZone.findUnique.mockResolvedValue(null);

    await expect(
      service.recordImpression(createEvent()),
    ).resolves.toBeUndefined();
    expect(adBillingService.billCpmBatch).not.toHaveBeenCalled();
  });
});
