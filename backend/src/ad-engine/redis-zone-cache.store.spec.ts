import {
  ACTIVE_ZONES_SET_KEY,
  RedisZoneCacheStore,
  zoneCacheKey,
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

  it('stages the new active-zone set, atomically renames it into place, then writes each layoutType', async () => {
    commandSpy.mockImplementation(async (command) => {
      if (command[0] === 'SMEMBERS') {
        return [];
      }
      return 1;
    });

    await store.replaceActiveZoneIds([
      { id: 'zone-1', layoutType: 'MEDIUM_RECTANGLE_300X250' },
      { id: 'zone-2', layoutType: 'POPUP' },
    ]);

    expect(commandSpy).toHaveBeenNthCalledWith(1, [
      'SMEMBERS',
      ACTIVE_ZONES_SET_KEY,
    ]);
    expect(commandSpy).toHaveBeenNthCalledWith(2, [
      'DEL',
      `${ACTIVE_ZONES_SET_KEY}:staging`,
    ]);
    expect(commandSpy).toHaveBeenNthCalledWith(3, [
      'SADD',
      `${ACTIVE_ZONES_SET_KEY}:staging`,
      'zone-1',
      'zone-2',
    ]);
    expect(commandSpy).toHaveBeenNthCalledWith(4, [
      'RENAME',
      `${ACTIVE_ZONES_SET_KEY}:staging`,
      ACTIVE_ZONES_SET_KEY,
    ]);
    expect(commandSpy).toHaveBeenCalledWith([
      'HSET',
      zoneCacheKey('zone-1'),
      'layoutType',
      'MEDIUM_RECTANGLE_300X250',
    ]);
    expect(commandSpy).toHaveBeenCalledWith([
      'HSET',
      zoneCacheKey('zone-2'),
      'layoutType',
      'POPUP',
    ]);
  });

  it('deletes the layoutType hash for a zone that dropped out of the active set', async () => {
    commandSpy.mockImplementation(async (command) => {
      if (command[0] === 'SMEMBERS') {
        return ['zone-stale'];
      }
      return 1;
    });

    await store.replaceActiveZoneIds([
      { id: 'zone-1', layoutType: 'MEDIUM_RECTANGLE_300X250' },
    ]);

    expect(commandSpy).toHaveBeenCalledWith(['DEL', zoneCacheKey('zone-stale')]);
  });

  it('clears the live set directly when there are no active zones, skipping the RENAME', async () => {
    commandSpy.mockImplementation(async (command) => {
      if (command[0] === 'SMEMBERS') {
        return [];
      }
      return 1;
    });

    await store.replaceActiveZoneIds([]);

    expect(commandSpy).toHaveBeenCalledWith(['DEL', ACTIVE_ZONES_SET_KEY]);
    expect(commandSpy).not.toHaveBeenCalledWith([
      'RENAME',
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('returns the layoutType for an active zone', async () => {
    commandSpy.mockImplementation(async (command) => {
      if (command[0] === 'SISMEMBER') {
        return 1;
      }
      if (command[0] === 'HGET') {
        return 'MEDIUM_RECTANGLE_300X250';
      }
      return null;
    });

    await expect(store.getActiveZone('zone-1')).resolves.toEqual({
      layoutType: 'MEDIUM_RECTANGLE_300X250',
    });
  });

  it('reports no zone (paused, deleted, or never real) when it is not a member', async () => {
    commandSpy.mockResolvedValueOnce(0);

    await expect(store.getActiveZone('not-a-real-zone')).resolves.toBeNull();
  });
});
