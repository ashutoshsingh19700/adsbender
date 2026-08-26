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

export type AdEvent = ImpressionEvent | ClickEvent;

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
}
