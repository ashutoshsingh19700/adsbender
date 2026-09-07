import { Inject, Injectable, Logger } from '@nestjs/common';

import type {
  ClickEvent,
  ImpressionEvent,
  MessageBrokerPublisher,
  TrafficEvent,
} from './ad-event.types';

export const MESSAGE_BROKER_PUBLISHER = Symbol('MESSAGE_BROKER_PUBLISHER');
export const IMPRESSION_EVENTS_CHANNEL = 'adengine:events:impressions';
export const CLICK_EVENTS_CHANNEL = 'adengine:events:clicks';
export const TRAFFIC_EVENTS_CHANNEL = 'adengine:events:traffic';

@Injectable()
export class AdEventProducerService {
  private readonly logger = new Logger(AdEventProducerService.name);

  constructor(
    @Inject(MESSAGE_BROKER_PUBLISHER)
    private readonly messageBrokerPublisher: MessageBrokerPublisher,
  ) {}

  publishImpression(event: ImpressionEvent) {
    void this.messageBrokerPublisher
      .publish(IMPRESSION_EVENTS_CHANNEL, event)
      .catch((error) => {
        this.logger.error('Failed to publish impression event', error);
      });
  }

  publishClick(event: ClickEvent) {
    void this.messageBrokerPublisher
      .publish(CLICK_EVENTS_CHANNEL, event)
      .catch((error) => {
        this.logger.error('Failed to publish click event', error);
      });
  }

  // Fire-and-forget, same as the two above - a lost fraud-analytics event
  // must never hold up (or fail) the actual ad response/redirect it was
  // derived from.
  publishTraffic(event: TrafficEvent) {
    void this.messageBrokerPublisher
      .publish(TRAFFIC_EVENTS_CHANNEL, event)
      .catch((error) => {
        this.logger.error('Failed to publish traffic event', error);
      });
  }
}
