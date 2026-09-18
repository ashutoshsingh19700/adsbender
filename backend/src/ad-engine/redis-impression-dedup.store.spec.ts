import { Logger } from '@nestjs/common';

import { RedisImpressionDedupStore } from './redis-impression-dedup.store';
import { RedisRespClient } from './redis-resp.client';

describe('RedisImpressionDedupStore', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let store: RedisImpressionDedupStore;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    commandSpy = jest.spyOn(RedisRespClient.prototype, 'command');
    store = new RedisImpressionDedupStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    store.onModuleDestroy();
  });

  it('claims a key with SET NX EX and reports it as newly-unique', async () => {
    commandSpy.mockResolvedValue('OK');

    await expect(
      store.claimOnce('pubimp:site:site-1:127.0.0.1', 86_400),
    ).resolves.toBe(true);
    expect(commandSpy).toHaveBeenCalledWith([
      'SET',
      'pubimp:site:site-1:127.0.0.1',
      '1',
      'NX',
      'EX',
      86_400,
    ]);
  });

  it('reports an already-claimed key (repeat view within the window) as not unique', async () => {
    commandSpy.mockResolvedValue(null);

    await expect(
      store.claimOnce('pubimp:site:site-1:127.0.0.1', 86_400),
    ).resolves.toBe(false);
  });

  it('fails open to unique when Redis is unavailable', async () => {
    commandSpy.mockRejectedValue(new Error('connection refused'));

    await expect(
      store.claimOnce('pubimp:site:site-1:127.0.0.1', 86_400),
    ).resolves.toBe(true);
  });
});
