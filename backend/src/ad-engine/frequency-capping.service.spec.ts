import { Test, TestingModule } from '@nestjs/testing';

import {
  FrequencyCappingService,
  VELOCITY_COUNTER_STORE,
} from './frequency-capping.service';
import type { VelocityCounterStore } from './velocity-cap.types';

describe('FrequencyCappingService', () => {
  let service: FrequencyCappingService;
  let store: jest.Mocked<VelocityCounterStore>;

  beforeEach(async () => {
    store = {
      increment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrequencyCappingService,
        {
          provide: VELOCITY_COUNTER_STORE,
          useValue: store,
        },
      ],
    }).compile();

    service = module.get(FrequencyCappingService);
  });

  it('allows the first two impressions inside the 30-second rolling window', async () => {
    store.increment.mockResolvedValue({
      key: 'rate:imp:127.0.0.1',
      count: 2,
      ttlSeconds: 30,
    });

    await expect(
      service.evaluateImpression('::ffff:127.0.0.1'),
    ).resolves.toEqual({
      allowed: true,
      key: 'rate:imp:127.0.0.1',
      count: 2,
      limit: 2,
      ttlSeconds: 30,
      reason: undefined,
    });
    expect(store.increment).toHaveBeenCalledWith('rate:imp:127.0.0.1', 30);
  });

  it('throttles the third impression inside the 30-second rolling window', async () => {
    store.increment.mockResolvedValue({
      key: 'rate:imp:127.0.0.1',
      count: 3,
      ttlSeconds: 30,
    });

    await expect(service.evaluateImpression('127.0.0.1')).resolves.toEqual({
      allowed: false,
      key: 'rate:imp:127.0.0.1',
      count: 3,
      limit: 2,
      ttlSeconds: 30,
      reason: 'IMPRESSION_VELOCITY_EXCEEDED',
    });
  });

  it('allows the first three clicks inside the 60-second rolling window', async () => {
    store.increment.mockResolvedValue({
      key: 'rate:click:127.0.0.1',
      count: 3,
      ttlSeconds: 60,
    });

    await expect(service.evaluateClick('127.0.0.1')).resolves.toEqual({
      allowed: true,
      key: 'rate:click:127.0.0.1',
      count: 3,
      limit: 3,
      ttlSeconds: 60,
      reason: undefined,
    });
    expect(store.increment).toHaveBeenCalledWith('rate:click:127.0.0.1', 60);
  });

  it('throttles the fourth click inside the 60-second rolling window', async () => {
    store.increment.mockResolvedValue({
      key: 'rate:click:127.0.0.1',
      count: 4,
      ttlSeconds: 60,
    });

    await expect(service.evaluateClick('::ffff:127.0.0.1')).resolves.toEqual({
      allowed: false,
      key: 'rate:click:127.0.0.1',
      count: 4,
      limit: 3,
      ttlSeconds: 60,
      reason: 'CLICK_VELOCITY_EXCEEDED',
    });
  });
});
