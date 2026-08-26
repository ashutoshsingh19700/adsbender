import { Inject, Injectable } from '@nestjs/common';

import type { FrequencyCapCounterStore } from './velocity-cap.types';

export const VISITOR_FREQUENCY_CAP_STORE = Symbol(
  'VISITOR_FREQUENCY_CAP_STORE',
);

// Platform-wide fallback, used only when a campaign doesn't set its own
// frequencyCapImpressions/frequencyCapWindowSeconds (see schema.prisma).
// Every campaign is still capped somehow - there's no env var to disable
// capping globally, only to tune the default.
const DEFAULT_IMPRESSION_LIMIT = Number(
  process.env.VISITOR_FREQUENCY_CAP_IMPRESSIONS ?? 3,
);
const DEFAULT_WINDOW_SECONDS = Number(
  process.env.VISITOR_FREQUENCY_CAP_WINDOW_SECONDS ?? 86400,
);

// Per-visitor, per-campaign impression capping - distinct from
// FrequencyCappingService, which throttles raw request velocity (too many
// hits per IP per second) as an anti-fraud measure. This is about ad
// quality: don't show the SAME campaign to the SAME visitor more than N
// times inside a rolling window, even if every request is legitimate.
//
// The limit/window are per-campaign (see AdTargetingService, which reads
// them off the campaign cache record and passes them into every call
// here) rather than fixed on this service, so each advertiser can tune how
// aggressively their own campaign rotates for a given visitor. Passing
// neither falls back to the platform default above.
@Injectable()
export class VisitorFrequencyCapService {
  constructor(
    @Inject(VISITOR_FREQUENCY_CAP_STORE)
    private readonly store: FrequencyCapCounterStore,
  ) {}

  // No visitorId (couldn't be derived, e.g. no IP on the request) means we
  // have no identity to cap against - fail open rather than blocking every
  // uncapped request from being served at all.
  async isCapped(
    visitorId: string,
    campaignId: string,
    impressionLimit?: number | null,
  ): Promise<boolean> {
    if (!visitorId) {
      return false;
    }

    const count = await this.store.get(this.keyFor(visitorId, campaignId));

    return count >= this.resolveLimit(impressionLimit);
  }

  async recordImpression(
    visitorId: string,
    campaignId: string,
    windowSeconds?: number | null,
  ): Promise<void> {
    if (!visitorId) {
      return;
    }

    await this.store.increment(
      this.keyFor(visitorId, campaignId),
      this.resolveWindow(windowSeconds),
    );
  }

  private resolveLimit(impressionLimit?: number | null): number {
    return impressionLimit && impressionLimit > 0
      ? impressionLimit
      : DEFAULT_IMPRESSION_LIMIT;
  }

  private resolveWindow(windowSeconds?: number | null): number {
    return windowSeconds && windowSeconds > 0
      ? windowSeconds
      : DEFAULT_WINDOW_SECONDS;
  }

  private keyFor(visitorId: string, campaignId: string): string {
    return `freqcap:${campaignId}:${visitorId}`;
  }
}
