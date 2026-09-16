import { ACTIVE_ZONES_KEY, RedisZoneCacheStore } from './redis-zone-cache.store';
import { RedisRespClient } from './redis-resp.client';

describe('RedisZoneCacheStore', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let store: RedisZoneCacheStore;

  beforeEach(() => {
    commandSpy = jest.spyOn(RedisRespClient.prototype, 'command');
    store = new RedisZoneCacheStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    store.onModuleDestroy();
  });

  it('writes the whole active-zone list as a single JSON blob in one command', async () => {
    commandSpy.mockResolvedValue('OK');

    await store.replaceActiveZoneIds([
      { id: 'zone-1', layoutType: 'MEDIUM_RECTANGLE_300X250' },
      { id: 'zone-2', layoutType: 'POPUP' },
    ]);

    expect(commandSpy).toHaveBeenCalledTimes(1);
    expect(commandSpy).toHaveBeenCalledWith([
      'SET',
      ACTIVE_ZONES_KEY,
      JSON.stringify([
        { id: 'zone-1', layoutType: 'MEDIUM_RECTANGLE_300X250' },
        { id: 'zone-2', layoutType: 'POPUP' },
      ]),
    ]);
  });

  it('returns the layoutType for an active zone in a single command', async () => {
    commandSpy.mockResolvedValue(
      JSON.stringify([
        { id: 'zone-1', layoutType: 'MEDIUM_RECTANGLE_300X250' },
      ]),
    );

    await expect(store.getActiveZone('zone-1')).resolves.toEqual({
      layoutType: 'MEDIUM_RECTANGLE_300X250',
    });
    expect(commandSpy).toHaveBeenCalledTimes(1);
    expect(commandSpy).toHaveBeenCalledWith(['GET', ACTIVE_ZONES_KEY]);
  });

  it('reports no zone (paused, deleted, or never real) when it is not in the cached list', async () => {
    commandSpy.mockResolvedValue(
      JSON.stringify([{ id: 'zone-1', layoutType: 'POPUP' }]),
    );

    await expect(store.getActiveZone('not-a-real-zone')).resolves.toBeNull();
  });

  it('reports no zone when the cache is empty', async () => {
    commandSpy.mockResolvedValue(null);

    await expect(store.getActiveZone('zone-1')).resolves.toBeNull();
  });

  it('fails open to not-found when Redis is unavailable', async () => {
    commandSpy.mockRejectedValue(new Error('connection refused'));

    await expect(store.getActiveZone('zone-1')).resolves.toBeNull();
  });
});
