import { Test, TestingModule } from '@nestjs/testing';

import {
  VISITOR_FREQUENCY_CAP_STORE,
  VisitorFrequencyCapService,
} from './visitor-frequency-cap.service';
import type { FrequencyCapCounterStore } from './velocity-cap.types';

describe('VisitorFrequencyCapService', () => {
  let service: VisitorFrequencyCapService;
  let store: jest.Mocked<FrequencyCapCounterStore>;

  beforeEach(async () => {
    store = {
      get: jest.fn(),
      increment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorFrequencyCapService,
        {
          provide: VISITOR_FREQUENCY_CAP_STORE,
          useValue: store,
        },
      ],
    }).compile();

    service = module.get(VisitorFrequencyCapService);
  });

  it('allows a visitor under the platform-default impression limit when the campaign sets no override', async () => {
    store.get.mockResolvedValue(2);

    await expect(service.isCapped('visitor-1', 'campaign-1')).resolves.toBe(
      false,
    );
    expect(store.get).toHaveBeenCalledWith('freqcap:campaign-1:visitor-1');
  });

  it('caps a visitor at the platform-default limit (3) when the campaign sets no override', async () => {
    store.get.mockResolvedValue(3);

    await expect(service.isCapped('visitor-1', 'campaign-1')).resolves.toBe(
      true,
    );
  });

  it("honors a campaign's own, stricter impression limit", async () => {
    store.get.mockResolvedValue(1);

    await expect(
      service.isCapped('visitor-1', 'campaign-1', 1),
    ).resolves.toBe(true);
  });

  it("honors a campaign's own, looser impression limit", async () => {
    store.get.mockResolvedValue(3);

    await expect(
      service.isCapped('visitor-1', 'campaign-1', 10),
    ).resolves.toBe(false);
  });

  it('falls back to the platform default when the campaign override is null or zero', async () => {
    store.get.mockResolvedValue(3);

    await expect(
      service.isCapped('visitor-1', 'campaign-1', null),
    ).resolves.toBe(true);
    await expect(
      service.isCapped('visitor-1', 'campaign-1', 0),
    ).resolves.toBe(true);
  });

  it('fails open when no visitor identity is available', async () => {
    await expect(service.isCapped('', 'campaign-1')).resolves.toBe(false);
    expect(store.get).not.toHaveBeenCalled();
  });

  it('records an impression under the platform-default window when the campaign sets no override', async () => {
    await service.recordImpression('visitor-1', 'campaign-1');

    expect(store.increment).toHaveBeenCalledWith(
      'freqcap:campaign-1:visitor-1',
      86400,
    );
  });

  it("records an impression under the campaign's own window override", async () => {
    await service.recordImpression('visitor-1', 'campaign-1', 3600);

    expect(store.increment).toHaveBeenCalledWith(
      'freqcap:campaign-1:visitor-1',
      3600,
    );
  });

  it('does not record an impression when no visitor identity is available', async () => {
    await service.recordImpression('', 'campaign-1');

    expect(store.increment).not.toHaveBeenCalled();
  });

  it('caps different campaigns independently for the same visitor', async () => {
    store.get.mockImplementation(async (key) =>
      key === 'freqcap:campaign-capped:visitor-1' ? 3 : 0,
    );

    await expect(
      service.isCapped('visitor-1', 'campaign-capped'),
    ).resolves.toBe(true);
    await expect(
      service.isCapped('visitor-1', 'campaign-fresh'),
    ).resolves.toBe(false);
  });
});
