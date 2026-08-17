import { IMPRESSION_EVENTS_CHANNEL } from './ad-event-producer.service';
import { RedisRespClient } from './redis-resp.client';
import { RedisStreamMessageBrokerConsumer } from './redis-stream-message-broker.consumer';

describe('RedisStreamMessageBrokerConsumer', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let consumer: RedisStreamMessageBrokerConsumer;

  beforeEach(() => {
    commandSpy = jest.spyOn(RedisRespClient.prototype, 'command');
    consumer = new RedisStreamMessageBrokerConsumer();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    consumer.onModuleDestroy();
  });

  it('reads impression payloads from the Redis stream using XREAD batch semantics', async () => {
    const payload = {
      type: 'impression' as const,
      zone: '42',
      campaign: 'campaign-1',
      advertiser: 'advertiser-1',
      cost: 0.001,
      time: 1719274200,
      request: {
        origin: 'https://publisher.test',
        path: '/article',
        country: 'US',
        device: 'mobile',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Mobile',
      },
    };

    commandSpy.mockResolvedValue([
      [
        IMPRESSION_EVENTS_CHANNEL,
        [['1719274200-0', ['payload', JSON.stringify(payload)]]],
      ],
    ]);

    await expect(
      consumer.readBatch(IMPRESSION_EVENTS_CHANNEL, '0-0', 2000, 1000),
    ).resolves.toEqual([
      {
        id: '1719274200-0',
        payload,
      },
    ]);
    expect(commandSpy).toHaveBeenCalledWith([
      'XREAD',
      'COUNT',
      2000,
      'BLOCK',
      1000,
      'STREAMS',
      IMPRESSION_EVENTS_CHANNEL,
      '0-0',
    ]);
  });

  it('acknowledges processed stream entries by deleting them from the stream', async () => {
    commandSpy.mockResolvedValue(2);

    await consumer.acknowledge(IMPRESSION_EVENTS_CHANNEL, [
      '1719274200-0',
      '1719274200-1',
    ]);

    expect(commandSpy).toHaveBeenCalledWith([
      'XDEL',
      IMPRESSION_EVENTS_CHANNEL,
      '1719274200-0',
      '1719274200-1',
    ]);
  });
});
