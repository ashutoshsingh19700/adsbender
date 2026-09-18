type RequestContext = {
  origin: string;
  path: string;
  country: string | null;
  device: string;
  ipAddress: string;
  userAgent: string;
};

export type ImpressionEvent = {
  type: 'impression';
  zone: string;
  campaign: string;
  advertiser: string;
  // Analytics-only estimate (maxCpm/1000 for a CPM campaign, 0 for a CPC
  // one - see AdEngineController.serve) - NOT what actually gets billed.
  // Real CPM money moves in lump-sum batches; see CpmBillingService.
  cost: number;
  time: number;
  request: RequestContext;
  // Set only when this impression's campaign is CPM-priced (Campaign.maxCpm
  // is set) - tells CpmBillingService the per-1000-impression rate to bill
  // once the running count crosses a multiple of 1000. Undefined for a
  // regular CPC campaign, which isn't billed on impressions at all.
  maxCpm?: number;
  // Whether this is the FIRST impression from this IP against this
  // publisher's site in the current 24h window (see
  // PublisherImpressionDedupService) - the advertiser side of this event
  // (`cost`/`maxCpm` above) always counts every impression regardless of
  // this flag; only the publisher's own impression count/CPM payout
  // (CpmBillingService.recordImpression) and publisher-scoped dashboards
  // (ClickHouseAnalyticsQueryStore) are gated on it.
  uniquePublisherImpression: boolean;
};

export type ClickEvent = {
  type: 'click';
  zone: string;
  campaign: string;
  advertiser: string;
  cost: number;
  time: number;
  request: RequestContext;
};

// Every non-billable decision fraud detection makes about a /serve or
// /click request - both a hard block (the request never got an ad / never
// got tracked) and a soft flag (the request was allowed through, but looked
// suspicious enough to record, e.g. a datacenter IP). This is the ONLY place
// that traffic - the majority of what a bot generates - shows up at all: a
// blocked request never becomes an ImpressionEvent/ClickEvent, so without
// this type it would vanish with no analytics trail whatsoever. See
// FraudDetectionService and AdEngineController.
export type TrafficEvent = {
  type: 'traffic';
  // 'impression' = evaluated at /serve, 'click' = evaluated at /click.
  stage: 'impression' | 'click';
  outcome: 'blocked' | 'flagged';
  reason: string;
  zone: string;
  campaign?: string;
  advertiser?: string;
  time: number;
  request: RequestContext;
};

export type AdEvent = ImpressionEvent | ClickEvent | TrafficEvent;

export interface MessageBrokerPublisher {
  publish(channel: string, payload: AdEvent): Promise<void>;
}

export type BrokerMessage<TPayload> = {
  id: string;
  payload: TPayload;
};

export interface MessageBrokerConsumer {
  readBatch(
    channel: string,
    lastMessageId: string,
    count: number,
    blockMs: number,
  ): Promise<BrokerMessage<AdEvent>[]>;
  acknowledge(channel: string, messageIds: string[]): Promise<void>;
}

export interface AnalyticsEventStore {
  ensureSchema(): Promise<void>;
  insertImpressions(events: ImpressionEvent[]): Promise<void>;
  insertClicks(events: ClickEvent[]): Promise<void>;
  insertTrafficEvents(events: TrafficEvent[]): Promise<void>;
}
