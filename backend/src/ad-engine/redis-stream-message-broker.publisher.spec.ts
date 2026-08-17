import { RedisRespClient } from './redis-resp.client';
import { RedisStreamMessageBrokerPublisher } from './redis-stream-message-broker.publisher';

describe('RedisStreamMessageBrokerPublisher', () => {
  let commandSpy: jest.SpiedFunction<RedisRespClient['command']>;
  let publisher: RedisStreamMessageBrokerPublisher;

  beforeEach(() => {
    commandSpy = jest
      .spyOn(RedisRespClient.prototype, 'command')
      .mockResolvedValue('1719274200-0');
    publisher = new RedisStreamMessageBrokerPublisher();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    publisher.onModuleDestroy();
  });

  it('publishes impression payloads to a Redis stream for async ingestion workers', async () => {
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

    await publisher.publish('adengine:events:impressions', payload);

    expect(commandSpy).toHaveBeenCalledWith([
      'XADD',
      'adengine:events:impressions',
      '*',
      'payload',
      JSON.stringify(payload),
    ]);
  });
});
