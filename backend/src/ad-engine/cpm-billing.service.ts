import { Inject, Injectable, Logger } from '@nestjs/common';

import { AdBillingService } from './ad-billing.service';
import type { ImpressionEvent } from './ad-event.types';
import { VELOCITY_COUNTER_STORE } from './frequency-capping.service';
import type { VelocityCounterStore } from './velocity-cap.types';
import { PrismaService } from '../prisma/prisma.service';

export const IMPRESSIONS_PER_CPM_BATCH = 1000;
// A CPM counter must never expire mid-campaign (that would silently reset
// the count and either double-bill or skip a batch) - ~10 years is
// "effectively never" without needing a whole separate no-TTL Redis command
// path just for this one counter.
const CPM_COUNTER_TTL_SECONDS = 315_360_000;

// Real ad-tech reason this exists instead of just billing maxCpm/1000 on
// every impression: WalletManager only accepts amounts to 2 decimal places
// (see WalletManager.normalizeAmount), and a single impression's true cost
// under a CPM bid is usually a fraction of a cent (e.g. $2 CPM = $0.002 per
// impression) - completely unbillable as an individual ledger transaction.
// So impressions are counted per campaign, and the campaign's maxCpm is
// billed as one whole-cent lump sum every time the count crosses a
// multiple of 1000 - which is also just what "CPM" (cost per mille) means.
//
// TWO independent counters/batch streams run off every CPM impression: the
// advertiser is charged once every 1000 RAW impressions (every ad view
// counts, same visitor-on-a-different-page included), while the publisher
// is only credited once every 1000 UNIQUE impressions - one impression per
// IP per 24h per site, per PublisherImpressionDedupService/
// ImpressionEvent.uniquePublisherImpression (set by AdEngineController).
// The unique count is always <= the raw count, so this can only ever slow
// down (never speed up) how fast the publisher's own batches fill relative
// to the advertiser's - see AdBillingService's module comment for how that
// difference becomes platform revenue.
@Injectable()
export class CpmBillingService {
  private readonly logger = new Logger(CpmBillingService.name);

  constructor(
    @Inject(VELOCITY_COUNTER_STORE)
    private readonly counterStore: VelocityCounterStore,
    private readonly adBillingService: AdBillingService,
    private readonly prisma: PrismaService,
  ) {}

  // Called for every impression of a CPM-priced campaign (event.maxCpm set
  // - see AdEngineController.serve). Always advances the advertiser's raw
  // counter; only advances the publisher's unique counter when this
  // specific impression was flagged unique.
  async recordImpression(event: ImpressionEvent): Promise<void> {
    if (!event.maxCpm || event.maxCpm <= 0) {
      return;
    }

    await this.recordAdvertiserBatch(event);

    if (event.uniquePublisherImpression) {
      await this.recordPublisherBatch(event);
    }
  }

  // Bills the advertiser once every IMPRESSIONS_PER_CPM_BATCH RAW
  // impressions - unaffected by publisher-side dedup, matching the existing
  // "every ad view is billable to the advertiser" behavior.
  private async recordAdvertiserBatch(event: ImpressionEvent): Promise<void> {
    const counter = await this.counterStore.increment(
      this.rawCounterKey(event.campaign),
      CPM_COUNTER_TTL_SECONDS,
    );

    if (counter.count % IMPRESSIONS_PER_CPM_BATCH !== 0) {
      return;
    }

    const batchNumber = counter.count / IMPRESSIONS_PER_CPM_BATCH;

    await this.adBillingService.billCpmAdvertiserBatch(
      event.campaign,
      event.maxCpm as number,
      `cpm:${event.campaign}:batch:${batchNumber}`,
    );
  }

  // Credits the publisher once every IMPRESSIONS_PER_CPM_BATCH UNIQUE
  // impressions - its own counter/batch numbering, separate from the
  // advertiser's raw one above, so a namespaced ("unique-batch") reference
  // id is used for WalletManager's idempotency check.
  private async recordPublisherBatch(event: ImpressionEvent): Promise<void> {
    const counter = await this.counterStore.increment(
      this.uniqueCounterKey(event.campaign),
      CPM_COUNTER_TTL_SECONDS,
    );

    if (counter.count % IMPRESSIONS_PER_CPM_BATCH !== 0) {
      return;
    }

    const zone = await this.prisma.adZone.findUnique({
      where: { id: event.zone },
      select: { publisherId: true },
    });

    if (!zone) {
      this.logger.warn(
        `Skipping CPM publisher batch credit for campaign ${event.campaign}: zone ${event.zone} no longer exists`,
      );
      return;
    }

    const batchNumber = counter.count / IMPRESSIONS_PER_CPM_BATCH;

    await this.adBillingService.creditPublisherShare(
      zone.publisherId,
      event.maxCpm as number,
      `cpm:${event.campaign}:unique-batch:${batchNumber}`,
      'CPM billing (1000 unique impressions)',
    );
  }

  private rawCounterKey(campaignId: string): string {
    return `cpm:count:${campaignId}`;
  }

  private uniqueCounterKey(campaignId: string): string {
    return `cpm:unique:${campaignId}`;
  }
}
