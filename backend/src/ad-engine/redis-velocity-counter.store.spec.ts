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

  it('reads a counter without incrementing it', async () => {
    commandSpy.mockResolvedValueOnce('2');

    await expect(store.get('freqcap:campaign-1:visitor-1')).resolves.toBe(2);
    expect(commandSpy).toHaveBeenCalledTimes(1);
    expect(commandSpy).toHaveBeenCalledWith([
      'GET',
      'freqcap:campaign-1:visitor-1',
    ]);
  });

  it('treats a missing counter as zero rather than erroring', async () => {
    commandSpy.mockResolvedValueOnce(null);

    await expect(store.get('freqcap:campaign-1:visitor-1')).resolves.toBe(0);
  });

  it('reads several counters in a single MGET', async () => {
    commandSpy.mockResolvedValueOnce(['2', null, '5']);

    await expect(
      store.getMany(['freqcap:a:v1', 'freqcap:b:v1', 'freqcap:c:v1']),
    ).resolves.toEqual([2, 0, 5]);
    expect(commandSpy).toHaveBeenCalledTimes(1);
    expect(commandSpy).toHaveBeenCalledWith([
      'MGET',
      'freqcap:a:v1',
      'freqcap:b:v1',
      'freqcap:c:v1',
    ]);
  });

  it('skips the round trip entirely for an empty key list', async () => {
    await expect(store.getMany([])).resolves.toEqual([]);
    expect(commandSpy).not.toHaveBeenCalled();
  });

  it('fails open to all-zero counts when Redis is unavailable for a batched read', async () => {
    commandSpy.mockRejectedValueOnce(new Error('connection refused'));

    await expect(store.getMany(['freqcap:a:v1', 'freqcap:b:v1'])).resolves.toEqual([
      0, 0,
    ]);
  });
});
