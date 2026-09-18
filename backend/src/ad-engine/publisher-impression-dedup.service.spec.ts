import { Test, TestingModule } from '@nestjs/testing';

import type { ImpressionDedupStore } from './impression-dedup.types';
import {
  PUBLISHER_IMPRESSION_DEDUP_STORE,
  PublisherImpressionDedupService,
} from './publisher-impression-dedup.service';

describe('PublisherImpressionDedupService', () => {
  let service: PublisherImpressionDedupService;
  let store: jest.Mocked<ImpressionDedupStore>;

  beforeEach(async () => {
    store = { claimOnce: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublisherImpressionDedupService,
        { provide: PUBLISHER_IMPRESSION_DEDUP_STORE, useValue: store },
      ],
    }).compile();

    service = module.get(PublisherImpressionDedupService);
  });

  it('scopes the dedup key to the site when the zone has one', async () => {
    store.claimOnce.mockResolvedValue(true);

    await expect(
      service.isUniqueImpression(
        { publisherId: 'publisher-1', siteId: 'site-1' },
        '203.0.113.5',
      ),
    ).resolves.toBe(true);
    expect(store.claimOnce).toHaveBeenCalledWith(
      'pubimp:site:site-1:203.0.113.5',
      86_400,
    );
  });

  it('falls back to the whole publisher account when the zone has no site', async () => {
    store.claimOnce.mockResolvedValue(true);

    await service.isUniqueImpression(
      { publisherId: 'publisher-1', siteId: null },
      '203.0.113.5',
    );

    expect(store.claimOnce).toHaveBeenCalledWith(
      'pubimp:pub:publisher-1:203.0.113.5',
      86_400,
    );
  });

  it('treats different sites owned by the same publisher as separate scopes', async () => {
    store.claimOnce.mockResolvedValue(true);

    await service.isUniqueImpression(
      { publisherId: 'publisher-1', siteId: 'site-1' },
      '203.0.113.5',
    );
    await service.isUniqueImpression(
      { publisherId: 'publisher-1', siteId: 'site-2' },
      '203.0.113.5',
    );

    expect(store.claimOnce).toHaveBeenNthCalledWith(
      1,
      'pubimp:site:site-1:203.0.113.5',
      86_400,
    );
    expect(store.claimOnce).toHaveBeenNthCalledWith(
      2,
      'pubimp:site:site-2:203.0.113.5',
      86_400,
    );
  });

  it('normalizes an IPv4-mapped IPv6 address and strips a forwarded-for list down to the first hop', async () => {
    store.claimOnce.mockResolvedValue(true);

    await service.isUniqueImpression(
      { publisherId: 'publisher-1', siteId: 'site-1' },
      '::ffff:203.0.113.5, 10.0.0.1',
    );

    expect(store.claimOnce).toHaveBeenCalledWith(
      'pubimp:site:site-1:203.0.113.5',
      86_400,
    );
  });

  it('fails open (counts as unique) when there is no usable IP', async () => {
    await expect(
      service.isUniqueImpression(
        { publisherId: 'publisher-1', siteId: 'site-1' },
        '',
      ),
    ).resolves.toBe(true);
    expect(store.claimOnce).not.toHaveBeenCalled();
  });

  it('propagates a not-unique result from the store', async () => {
    store.claimOnce.mockResolvedValue(false);

    await expect(
      service.isUniqueImpression(
        { publisherId: 'publisher-1', siteId: 'site-1' },
        '203.0.113.5',
      ),
    ).resolves.toBe(false);
  });
});
