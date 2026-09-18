import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import {
  AdEventProducerService,
  CLICK_EVENTS_CHANNEL,
  IMPRESSION_EVENTS_CHANNEL,
  MESSAGE_BROKER_PUBLISHER,
} from './ad-event-producer.service';
import type {
  ClickEvent,
  ImpressionEvent,
  MessageBrokerPublisher,
} from './ad-event.types';

describe('AdEventProducerService', () => {
  let service: AdEventProducerService;
  let broker: jest.Mocked<MessageBrokerPublisher>;
  const event: ImpressionEvent = {
    type: 'impression',
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
    uniquePublisherImpression: true,
  };
  const clickEvent: ClickEvent = {
    type: 'click',
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

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    broker = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdEventProducerService,
        {
          provide: MESSAGE_BROKER_PUBLISHER,
          useValue: broker,
        },
      ],
    }).compile();

    service = module.get(AdEventProducerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches impression events to the broker channel without awaiting the broker write', () => {
    const neverResolvingPublish = new Promise<void>(() => undefined);
    broker.publish.mockReturnValue(neverResolvingPublish);

    expect(() => service.publishImpression(event)).not.toThrow();
    expect(broker.publish).toHaveBeenCalledWith(
      IMPRESSION_EVENTS_CHANNEL,
      event,
    );
  });

  it('swallows broker failures so ad serving is not broken by telemetry outages', async () => {
    broker.publish.mockRejectedValue(new Error('broker unavailable'));

    expect(() => service.publishImpression(event)).not.toThrow();
    await Promise.resolve();

    expect(broker.publish).toHaveBeenCalledWith(
      IMPRESSION_EVENTS_CHANNEL,
      event,
    );
  });

  it('dispatches click events to the click broker channel without awaiting the broker write', () => {
    const neverResolvingPublish = new Promise<void>(() => undefined);
    broker.publish.mockReturnValue(neverResolvingPublish);

    expect(() => service.publishClick(clickEvent)).not.toThrow();
    expect(broker.publish).toHaveBeenCalledWith(
      CLICK_EVENTS_CHANNEL,
      clickEvent,
    );
  });

  it('swallows broker failures for click events too', async () => {
    broker.publish.mockRejectedValue(new Error('broker unavailable'));

    expect(() => service.publishClick(clickEvent)).not.toThrow();
    await Promise.resolve();

    expect(broker.publish).toHaveBeenCalledWith(
      CLICK_EVENTS_CHANNEL,
      clickEvent,
    );
  });
});
