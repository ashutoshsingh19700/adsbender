import { Inject, Injectable } from '@nestjs/common';

import { CAMPAIGN_CACHE_STORE } from './campaign-cache-sync.service';
import type {
  CampaignCacheStore,
  ParsedCampaignCacheRecord,
} from './campaign-cache.types';
import { VisitorFrequencyCapService } from './visitor-frequency-cap.service';
import { PrismaService } from '../prisma/prisma.service';

export type TargetingRequest = {
  zoneId: string;
  country: string | null;
  device: string;
  // Stable per-visitor identifier (see AdEngineController) used only for
  // per-visitor frequency capping below. Optional/empty is valid - it just
  // means capping can't be applied to this request (fails open, see
  // VisitorFrequencyCapService).
  visitorId: string;
};

@Injectable()
export class AdTargetingService {
  constructor(
    @Inject(CAMPAIGN_CACHE_STORE)
    private readonly campaignCacheStore: CampaignCacheStore,
    private readonly prisma: PrismaService,
    private readonly visitorFrequencyCapService: VisitorFrequencyCapService,
  ) {}

  async selectCampaign(request: TargetingRequest) {
    // zoneId is client-suppliable (see AdEngineController.serve) and was
    // previously only ever threaded through to the response/impression
    // event, never checked against a real zone - any string, including a
    // paused or nonexistent zone's id, would still serve a live campaign.
    // Confirm the zone exists and is ACTIVE before spending any targeting
    // effort on it.
    const zone = await this.prisma.adZone
      .findUnique({
        where: { id: request.zoneId },
        select: { status: true },
      })
      // A malformed zoneId (not a UUID at all - e.g. a stale/hand-typed
      // integration) fails Postgres's uuid cast rather than just missing a
      // row. Either way there's no real zone behind it, so treat it the
      // same as "not found" instead of surfacing a 500.
      .catch(() => null);

    if (!zone || zone.status !== 'ACTIVE') {
      return null;
    }

    const campaigns = await this.campaignCacheStore.getActiveCampaigns();
    const eligible = campaigns.filter((campaign) =>
      this.isEligible(campaign, request),
    );
    const underCap = await this.filterUnderFrequencyCap(
      eligible,
      request.visitorId,
    );
    const selected = this.runSecondPriceAuction(underCap);

    if (selected) {
      // Awaited (not fire-and-forget) - the cap only works if the count it
      // reads back on the next request reflects this impression, and a
      // race here just means an occasional over-serve rather than a
      // dropped ad response, so the extra round trip is worth it. Passes
      // this campaign's own window override (falls back to the platform
      // default inside VisitorFrequencyCapService when unset).
      await this.visitorFrequencyCapService.recordImpression(
        request.visitorId,
        selected.id,
        selected.frequencyCapWindowSeconds,
      );
    }

    return selected;
  }

  // Drops any campaign the visitor has already hit ITS OWN impression cap
  // on (each campaign may override the platform default - see
  // Campaign.frequencyCapImpressions in schema.prisma), so a maxed-out
  // campaign can't win the rotation draw below at all - otherwise a
  // visitor who happens to keep winning that draw would never see
  // anything else even though other eligible campaigns exist.
  private async filterUnderFrequencyCap(
    eligible: ParsedCampaignCacheRecord[],
    visitorId: string,
  ): Promise<ParsedCampaignCacheRecord[]> {
    if (!visitorId || eligible.length === 0) {
      return eligible;
    }

    const cappedFlags = await Promise.all(
      eligible.map((campaign) =>
        this.visitorFrequencyCapService.isCapped(
          visitorId,
          campaign.id,
          campaign.frequencyCapImpressions,
        ),
      ),
    );

    return eligible.filter((_campaign, index) => !cappedFlags[index]);
  }

  // Second-price (Vickrey) auction: the highest bidder always wins, but is
  // only charged the runner-up's bid (never their own, if a runner-up
  // exists) - not a weighted lottery. This is the standard mechanism real
  // ad exchanges use; it also happens to make truthful bidding an
  // advertiser's best strategy (bidding your actual value, rather than
  // shading it down to guess what you'll be charged, can never cost you
  // more than bidding your real value would).
  //
  // "Rotation" across campaigns still happens in practice - just from
  // per-visitor frequency capping (see filterUnderFrequencyCap above)
  // taking the current top bidder out of contention for a visitor once
  // they've seen it enough, budgets running out, and different visitors
  // matching different eligible sets - not from injecting randomness into
  // who wins a single auction. The only randomness left here is breaking
  // an exact tie between two-or-more equal top bids, which is fair (each
  // gets an equal shot) rather than arbitrary (whoever happened to come
  // first in the cache's iteration order).
  private runSecondPriceAuction(
    eligible: ParsedCampaignCacheRecord[],
  ): ParsedCampaignCacheRecord | null {
    if (eligible.length === 0) {
      return null;
    }

    const bids = eligible.map((campaign) => ({
      campaign,
      unitBid: this.effectiveUnitBid(campaign),
    }));
    const topUnitBid = Math.max(...bids.map((entry) => entry.unitBid));
    const topTier = bids.filter((entry) => entry.unitBid === topUnitBid);
    const winnerEntry =
      topTier.length === 1
        ? topTier[0]
        : topTier[Math.floor(this.rollRandom() * topTier.length)];

    const runnerUpUnitBid = bids
      .filter((entry) => entry.campaign.id !== winnerEntry.campaign.id)
      .reduce((max, entry) => Math.max(max, entry.unitBid), 0);

    // No competition (only one eligible campaign, or every other eligible
    // campaign bid 0) - nothing to clear against, so the winner simply pays
    // their own bid rather than being charged $0.
    const clearingUnitBid =
      runnerUpUnitBid > 0
        ? Math.min(winnerEntry.unitBid, runnerUpUnitBid)
        : winnerEntry.unitBid;

    return this.applyClearingPrice(winnerEntry.campaign, clearingUnitBid);
  }

  // Returns a COPY of the winning campaign with maxCpc/maxCpm overwritten
  // by the auction's clearing price, converted back into whichever unit
  // that campaign actually bills in - everything downstream (billing, the
  // click URL, the impression event) reads maxCpc/maxCpm off whatever
  // selectCampaign returns without needing to know an auction happened at
  // all, so the clearing price becomes "the truth" for this impression the
  // moment it's decided here. Every other field (creative, frequency-cap
  // overrides, destinationUrl, ...) is passed through unchanged - only the
  // price the campaign is bound to actually pay is affected by the
  // auction.
  private applyClearingPrice(
    campaign: ParsedCampaignCacheRecord,
    clearingUnitBid: number,
  ): ParsedCampaignCacheRecord {
    if (campaign.maxCpm != null && campaign.maxCpm > 0) {
      return { ...campaign, maxCpm: this.roundToBillableCents(clearingUnitBid * 1000) };
    }

    return { ...campaign, maxCpc: this.roundToBillableCents(clearingUnitBid) };
  }

  // WalletManager only accepts amounts to exactly 2 decimal places (see
  // WalletManager.normalizeAmount) - a clearing price computed against a
  // CPM runner-up's per-unit-equivalent bid (maxCpm/1000) routinely lands
  // on a fraction of a cent (e.g. a $4 CPM runner-up clears at
  // $0.004/click), which isn't billable as-is. Round to the nearest cent,
  // and floor at $0.01 rather than letting a very cheap runner-up round a
  // real win down to $0.00 - that would make the advertiser's charge fail
  // outright (WalletManager rejects a zero amount) even though the ad was
  // already served, silently losing the revenue for this impression rather
  // than just charging it less than the "true" clearing price would be.
  private roundToBillableCents(amount: number): number {
    const rounded = Math.round(amount * 100) / 100;

    return rounded > 0 ? rounded : 0.01;
  }

  // A CPM campaign's meaningful bid is maxCpm (per 1000 impressions), not
  // maxCpc - dividing by 1000 puts it on the same rough per-unit scale as a
  // CPC campaign's per-click bid so they can be ranked in one auction. This
  // is a simplification, not true eCPM normalization (which would need each
  // campaign's predicted click-through rate, which isn't tracked) - it's
  // "roughly comparable," not "provably fair" between pricing models.
  private effectiveUnitBid(campaign: ParsedCampaignCacheRecord): number {
    if (campaign.maxCpm != null && campaign.maxCpm > 0) {
      return campaign.maxCpm / 1000;
    }

    return campaign.maxCpc;
  }

  // Isolated behind a method (rather than calling Math.random() inline) so
  // tests can stub the draw and make tie-breaking deterministic.
  protected rollRandom(): number {
    return Math.random();
  }

  private isEligible(
    campaign: ParsedCampaignCacheRecord,
    request: TargetingRequest,
  ) {
    if (campaign.status !== 'ACTIVE') {
      return false;
    }

    // For a CPM campaign this checks against its per-impression-equivalent
    // rate (maxCpm/1000) rather than maxCpc, which it may not even be
    // billed against - see effectiveUnitBid.
    if (campaign.advertiserBalanceUsd <= this.effectiveUnitBid(campaign)) {
      return false;
    }

    if (
      request.country &&
      campaign.targetCountries.length > 0 &&
      !campaign.targetCountries
        .map((country) => country.toUpperCase())
        .includes(request.country)
    ) {
      return false;
    }

    if (
      campaign.targetDevices.length > 0 &&
      !campaign.targetDevices
        .map((device) => device.toLowerCase())
        .includes(request.device.toLowerCase())
    ) {
      return false;
    }

    return true;
  }
}
