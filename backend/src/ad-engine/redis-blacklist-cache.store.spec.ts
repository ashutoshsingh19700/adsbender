import {
  BLACKLISTED_IPS_SET_KEY,
  RedisBlacklistCacheStore,
} from './redis-blacklist-cache.store';
import { RedisRespClient } from './redis-resp.client';

describe('RedisBlacklistCacheStore', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let store: RedisBlacklistCacheStore;

  beforeEach(() => {
    commandSpy = jest.spyOn(RedisRespClient.prototype, 'command');
    store = new RedisBlacklistCacheStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    store.onModuleDestroy();
  });

  it('stages the new blacklist set and atomically renames it into place', async () => {
    commandSpy.mockResolvedValue(1);

    await store.replaceBlacklistedIps(['1.2.3.4', '5.6.7.8']);

    expect(commandSpy).toHaveBeenNthCalledWith(1, [
      'DEL',
      `${BLACKLISTED_IPS_SET_KEY}:staging`,
    ]);
    expect(commandSpy).toHaveBeenNthCalledWith(2, [
      'SADD',
      `${BLACKLISTED_IPS_SET_KEY}:staging`,
      '1.2.3.4',
      '5.6.7.8',
    ]);
    expect(commandSpy).toHaveBeenNthCalledWith(3, [
      'RENAME',
      `${BLACKLISTED_IPS_SET_KEY}:staging`,
      BLACKLISTED_IPS_SET_KEY,
    ]);
  });

  it('clears the live set directly when the blacklist is empty, skipping the RENAME', async () => {
    commandSpy.mockResolvedValue(1);

    await store.replaceBlacklistedIps([]);

    expect(commandSpy).toHaveBeenCalledWith(['DEL', BLACKLISTED_IPS_SET_KEY]);
    expect(commandSpy).not.toHaveBeenCalledWith([
      'RENAME',
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('reports an IP blacklisted when it is a member of the cached set', async () => {
    commandSpy.mockResolvedValueOnce(1);

    await expect(store.isBlacklisted('1.2.3.4')).resolves.toBe(true);
    expect(commandSpy).toHaveBeenCalledWith([
      'SISMEMBER',
      BLACKLISTED_IPS_SET_KEY,
      '1.2.3.4',
    ]);
  });

  it('reports an IP not blacklisted when it is not a member', async () => {
    commandSpy.mockResolvedValueOnce(0);

    await expect(store.isBlacklisted('9.9.9.9')).resolves.toBe(false);
  });
});
