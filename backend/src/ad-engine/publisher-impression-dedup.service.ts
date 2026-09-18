import { Inject, Injectable } from '@nestjs/common';

import type { ImpressionDedupStore } from './impression-dedup.types';

export const PUBLISHER_IMPRESSION_DEDUP_STORE = Symbol(
  'PUBLISHER_IMPRESSION_DEDUP_STORE',
);

// A visitor who is served ads on their own site's zone is only worth one
// "impression" to the PUBLISHER per IP per rolling 24h window, no matter how
// many pages of the site they roam across in that window - unlike the
// advertiser side (see ImpressionEvent/CpmBillingService), which still bills
// and counts every single ad view as its own impression. This only affects
// the publisher's own counted/paid impressions (dashboards + CPM payout
// batching - see CpmBillingService.recordImpression); it never touches what
// the advertiser is charged.
const DEDUP_WINDOW_SECONDS = Number(
  process.env.PUBLISHER_IMPRESSION_DEDUP_WINDOW_SECONDS ?? 86_400,
);

@Injectable()
export class PublisherImpressionDedupService {
  constructor(
    @Inject(PUBLISHER_IMPRESSION_DEDUP_STORE)
    private readonly store: ImpressionDedupStore,
  ) {}

  // `zone.siteId` scopes the dedup to that one site (roaming its pages
  // counts once) so a different site owned by the same publisher still
  // counts separately. A zone created before PublisherSite existed (no
  // siteId) falls back to the whole publisher account instead of being
  // exempted from dedup entirely.
  async isUniqueImpression(
    zone: { publisherId: string; siteId: string | null },
    ipAddress: string,
  ): Promise<boolean> {
    const normalizedIp = this.normalizeIp(ipAddress);

    // No usable IP (e.g. stripped by a proxy) means no identity to dedup
    // against - fail open and count it, same as VisitorFrequencyCapService
    // does for its own visitorId.
    if (!normalizedIp) {
      return true;
    }

    const scope = zone.siteId ? `site:${zone.siteId}` : `pub:${zone.publisherId}`;

    return this.store.claimOnce(
      `pubimp:${scope}:${normalizedIp}`,
      DEDUP_WINDOW_SECONDS,
    );
  }

  private normalizeIp(ipAddress: string): string {
    return (ipAddress ?? '')
      .replace('::ffff:', '')
      .split(',')[0]
      .trim();
  }
}
