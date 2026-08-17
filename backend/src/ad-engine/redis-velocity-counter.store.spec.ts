import { RedisRespClient } from './redis-resp.client';
import { RedisVelocityCounterStore } from './redis-velocity-counter.store';

describe('RedisVelocityCounterStore', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let store: RedisVelocityCounterStore;

  beforeEach(() => {
    commandSpy = jest.spyOn(RedisRespClient.prototype, 'command');
    store = new RedisVelocityCounterStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    store.onModuleDestroy();
  });

  it('increments a rolling counter and sets TTL when the key is new', async () => {
    commandSpy.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await expect(store.increment('rate:imp:127.0.0.1', 30)).resolves.toEqual({
      key: 'rate:imp:127.0.0.1',
      count: 1,
      ttlSeconds: 30,
    });
    expect(commandSpy).toHaveBeenCalledWith(['INCR', 'rate:imp:127.0.0.1']);
    expect(commandSpy).toHaveBeenCalledWith([
      'EXPIRE',
      'rate:imp:127.0.0.1',
      30,
    ]);
  });

  it('does not reset TTL for an existing rolling counter', async () => {
    commandSpy.mockResolvedValueOnce(3);

    await store.increment('rate:imp:127.0.0.1', 30);

    expect(commandSpy).toHaveBeenCalledTimes(1);
    expect(commandSpy).toHaveBeenCalledWith(['INCR', 'rate:imp:127.0.0.1']);
  });
});
