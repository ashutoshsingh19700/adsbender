import {
  ACTIVE_ZONES_SET_KEY,
  RedisZoneCacheStore,
} from './redis-zone-cache.store';
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

  it('stages the new active-zone set and atomically renames it into place', async () => {
    commandSpy.mockResolvedValue(1);

    await store.replaceActiveZoneIds(['zone-1', 'zone-2']);

    expect(commandSpy).toHaveBeenNthCalledWith(1, [
      'DEL',
      `${ACTIVE_ZONES_SET_KEY}:staging`,
    ]);
    expect(commandSpy).toHaveBeenNthCalledWith(2, [
      'SADD',
      `${ACTIVE_ZONES_SET_KEY}:staging`,
      'zone-1',
      'zone-2',
    ]);
    expect(commandSpy).toHaveBeenNthCalledWith(3, [
      'RENAME',
      `${ACTIVE_ZONES_SET_KEY}:staging`,
      ACTIVE_ZONES_SET_KEY,
    ]);
  });

  it('clears the live set directly when there are no active zones, skipping the RENAME', async () => {
    commandSpy.mockResolvedValue(1);

    await store.replaceActiveZoneIds([]);

    expect(commandSpy).toHaveBeenCalledWith(['DEL', ACTIVE_ZONES_SET_KEY]);
    expect(commandSpy).not.toHaveBeenCalledWith([
      'RENAME',
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('reports a zone active when it is a member of the cached set', async () => {
    commandSpy.mockResolvedValueOnce(1);

    await expect(store.isActiveZone('zone-1')).resolves.toBe(true);
    expect(commandSpy).toHaveBeenCalledWith([
      'SISMEMBER',
      ACTIVE_ZONES_SET_KEY,
      'zone-1',
    ]);
  });

  it('reports a zone inactive (paused, deleted, or never real) when it is not a member', async () => {
    commandSpy.mockResolvedValueOnce(0);

    await expect(store.isActiveZone('not-a-real-zone')).resolves.toBe(false);
  });
});
