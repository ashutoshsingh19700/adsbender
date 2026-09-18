import { Inject, Injectable } from '@nestjs/common';

import { CAMPAIGN_CACHE_STORE } from './campaign-cache-sync.service';
import type {
  CampaignCacheStore,
  ParsedCampaignCacheRecord,
} from './campaign-cache.types';
import { VisitorFrequencyCapService } from './visitor-frequency-cap.service';
import { ZONE_CACHE_STORE } from './zone-cache-sync.service';
import type { ZoneCacheStore } from './zone-cache.types';

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
    @Inject(ZONE_CACHE_STORE)
    private readonly zoneCacheStore: ZoneCacheStore,
    private readonly visitorFrequencyCapService: VisitorFrequencyCapService,
  ) {}

  async selectCampaign(request: TargetingRequest) {
    // zoneId is client-suppliable (see AdEngineController.serve) and was
    // previously only ever threaded through to the response/impression
    // event, never checked against a real zone - any string, including a
    // paused or nonexistent zone's id, would still serve a live campaign.
    // Confirm the zone exists and is ACTIVE before spending any targeting
    // effort on it.
    //
    // Reads the Redis-cached ACTIVE zone record (see ZoneCacheSyncService)
    // rather than querying Postgres on every single /serve request -
    // that's now a plain SISMEMBER+HGET (no query planning, no network
    // round trip to a cross-region DB), same reasoning as the campaign
    // cache this already mirrors. A newly-created or just-reactivated zone
    // can take up to ZONE_CACHE_SYNC_INTERVAL_MS to start serving, and a
    // just-paused one up to that long to stop - the same staleness budget
    // already accepted for campaigns. A malformed zoneId (not a real UUID
    // at all) is simply never a member of the set, so it falls out the
    // same "not found" path as any other unknown id, no special handling
    // needed the way the old Postgres uuid-cast failure required.
    const zone = await this.zoneCacheStore.getActiveZone(request.zoneId);

    if (!zone) {
      return null;
    }

    const campaigns = await this.campaignCacheStore.getActiveCampaigns();
    const eligible = campaigns.filter((campaign) =>
      this.isEligible(
        campaign,
        request,
        zone.layoutType,
        zone.allowedCategories,
      ),
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

    // One batched Redis read (MGET) for every eligible campaign instead of
    // one GET per campaign - this ran on every single /serve request, so
    // with N eligible campaigns it billed N Redis commands for a single ad
    // impression.
    const cappedFlags = await this.visitorFrequencyCapService.filterCapped(
      visitorId,
      eligible,
    );

    return eligible.filter((_campaign, index) => !cappedFlags[index]);
  }

  // Second-price (Vickrey) clearing rule with a bid-WEIGHTED winner draw:
  // every eligible campaign gets a shot at winning proportional to its bid
  // (a campaign bidding 2x another wins roughly 2x as often), rather than
  // the single highest bidder always winning outright. This is what gives a
  // publisher's zone actual rotation among the campaigns competing for it -
  // e.g. every eligible campaign in an allowed category (see
  // AdZone.allowedCategories/isEligible) gets served over time instead of
  // one campaign permanently crowding the others out - while still letting
  // a higher bid buy more impression share, and still charging only the
  // second-highest bid (never the winner's own, if a runner-up exists) once
  // a winner is drawn, so overpaying relative to the actual competition is
  // never rewarded.
  //
  // Frequency capping (see filterUnderFrequencyCap above) and budget/balance
  // checks (see isEligible) still run before this draw, so a maxed-out or
  // broke campaign can't win regardless of its bid.
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
    const winnerEntry = this.drawWeightedWinner(bids);

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
  // tests can stub the draw and make it deterministic.
  protected rollRandom(): number {
    return Math.random();
  }

  // Bid-weighted random draw over a cumulative-weight line: each entry's
  // slice of [0, totalBid) is proportional to its own bid, then one
  // rollRandom() pick lands in exactly one slice. A higher bid gets a wider
  // slice (wins more often) without ever being a guaranteed win the way
  // "highest bid wins" was - that's what makes this an actual rotation
  // rather than one campaign permanently owning the zone. When every bid is
  // 0 (shouldn't normally happen - isEligible already requires balance >
  // bid - but guards against a division by zero) falls back to a plain
  // uniform draw so every eligible campaign still gets an equal shot.
  private drawWeightedWinner(
    bids: { campaign: ParsedCampaignCacheRecord; unitBid: number }[],
  ): { campaign: ParsedCampaignCacheRecord; unitBid: number } {
    const totalBid = bids.reduce((sum, entry) => sum + entry.unitBid, 0);

    if (totalBid <= 0) {
      return bids[Math.floor(this.rollRandom() * bids.length)];
    }

    const target = this.rollRandom() * totalBid;
    let cumulative = 0;

    for (const entry of bids) {
      cumulative += entry.unitBid;
      if (target < cumulative) {
        return entry;
      }
    }

    // Floating-point rounding can leave `target` a hair above the final
    // cumulative sum - fall back to the last entry rather than returning
    // undefined.
    return bids[bids.length - 1];
  }

  private isEligible(
    campaign: ParsedCampaignCacheRecord,
    request: TargetingRequest,
    zoneLayoutType: string,
    zoneAllowedCategories: string[],
  ) {
    if (campaign.status !== 'ACTIVE') {
      return false;
    }

    // A campaign's adFormat must match the exact format the publisher built
    // this zone for (a "Popup" zone must never serve a plain banner
    // campaign, or vice versa - see RENDER_FAMILY_BY_FORMAT and
    // publisher_tag.js, which render each format's DOM/JS behavior
    // completely differently). A campaign with no adFormat predates this
    // feature and stays wildcard-eligible everywhere rather than being
    // orphaned from every zone the moment this shipped.
    if (
      campaign.adFormat &&
      zoneLayoutType &&
      campaign.adFormat !== zoneLayoutType
    ) {
      return false;
    }

    // A zone restricted to specific categories (see AdZone.allowedCategories)
    // only serves campaigns tagged with one of them. A campaign with no
    // category set stays wildcard-eligible everywhere (predates this
    // feature, or the advertiser simply left it unset) - same reasoning as
    // the adFormat wildcard above. An unrestricted zone (empty
    // allowedCategories) never filters on category at all.
    if (
      zoneAllowedCategories.length > 0 &&
      campaign.category &&
      !zoneAllowedCategories.includes(campaign.category)
    ) {
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
