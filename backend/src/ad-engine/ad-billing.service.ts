import { ConflictException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WalletManager } from '../wallet/wallet-manager.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import type { ClickEvent } from './ad-event.types';

// Turns a delivered click/impression/conversion into real money movement. A
// campaign is billed on ONE of: click (the default, pay-per-click model -
// Campaign.maxCpc), impression in batches of 1000 (opt-in CPM model -
// Campaign.maxCpm, see CpmBillingService), or a verified conversion
// postback (opt-in CPA model - Campaign.maxCpa, see
// ConversionTrackingService) - never click AND CPM for the same campaign
// (AdEngineController zeroes out whichever event type a CPM/CPA campaign
// doesn't bill on, so billClick just no-ops on a cost of 0 for them), though
// CPM and CPA CAN be combined (paying both per-impression and per-conversion
// is a valid, if unusual, setup).
//
// The advertiser is always charged the FULL cost; the publisher is credited
// only their share after the platform's cut (see PlatformSettingsService) -
// the difference is the platform's revenue, same as
// AdminService.getRevenueSummary already assumes.
@Injectable()
export class AdBillingService {
  private readonly logger = new Logger(AdBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletManager: WalletManager,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  // `referenceId` must be stable for a given click (the caller passes the
  // Redis stream message id) so a re-delivered/retried message can't
  // double-bill - WalletManager.recordCampaignSpend/creditPublisherEarning
  // are both idempotent on (walletId, type, referenceId) and turn a repeat
  // into a DUPLICATE_TRANSACTION ConflictException, which we treat as
  // "already billed" rather than an error.
  //
  // Deliberately never throws - a single bad/unbillable event (paused
  // campaign, deleted zone, etc.) must not stall the whole batch behind it
  // or block the caller from acknowledging the message.
  async billClick(event: ClickEvent, referenceId: string): Promise<void> {
    if (!(event.cost > 0)) {
      return;
    }

    const zone = await this.prisma.adZone.findUnique({
      where: { id: event.zone },
      select: { publisherId: true },
    });

    if (!zone) {
      this.logger.warn(
        `Skipping billing for click ${referenceId}: zone ${event.zone} no longer exists`,
      );
      return;
    }

    try {
      await this.walletManager.recordCampaignSpend(
        event.campaign,
        event.cost,
        referenceId,
        `Click on zone ${event.zone}`,
      );
    } catch (error) {
      if (this.isDuplicateTransaction(error)) {
        return;
      }

      // Advertiser genuinely couldn't be charged (campaign paused since it
      // served, reserved budget exhausted, etc.) - don't credit the
      // publisher for spend that was never actually collected.
      this.logger.warn(
        `Advertiser spend failed for click ${referenceId} (campaign ${event.campaign}): ${this.describe(error)}`,
      );
      return;
    }

    await this.creditPublisherShare(
      zone.publisherId,
      event.cost,
      referenceId,
      `Click on zone ${event.zone}`,
    );
  }

  // Called by CpmBillingService once every 1000 impressions of a CPM-priced
  // campaign - `maxCpm` is charged as a single lump sum (never per-impression
  // - see the module comment above and CpmBillingService for why).
  async billCpmBatch(
    campaignId: string,
    publisherId: string,
    maxCpm: number,
    referenceId: string,
  ): Promise<void> {
    await this.chargeCampaignAndCreditPublisher(
      campaignId,
      publisherId,
      maxCpm,
      referenceId,
      'CPM billing (1000 impressions)',
    );
  }

  // Called by ConversionTrackingService once a postback confirms a real
  // conversion for a CPA-priced campaign - `maxCpa` is charged exactly once
  // per click (ConversionTrackingService's atomic claim on AdClick.id is
  // what guarantees that), never on the click itself.
  async billConversion(
    campaignId: string,
    publisherId: string,
    maxCpa: number,
    referenceId: string,
  ): Promise<void> {
    await this.chargeCampaignAndCreditPublisher(
      campaignId,
      publisherId,
      maxCpa,
      referenceId,
      'CPA billing (verified conversion)',
    );
  }

  // Shared by billCpmBatch and billConversion - both charge the advertiser
  // one lump sum (as opposed to billClick's per-click charge) then credit
  // the publisher their post-fee share of it.
  private async chargeCampaignAndCreditPublisher(
    campaignId: string,
    publisherId: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<void> {
    try {
      await this.walletManager.recordCampaignSpend(
        campaignId,
        amount,
        referenceId,
        description,
      );
    } catch (error) {
      if (this.isDuplicateTransaction(error)) {
        return;
      }

      this.logger.warn(
        `Advertiser spend failed for ${referenceId} (campaign ${campaignId}): ${this.describe(error)}`,
      );
      return;
    }

    await this.creditPublisherShare(publisherId, amount, referenceId, description);
  }

  // Shared by billClick and CpmBillingService.billImpressionBatch - both
  // charge the advertiser the full amount above, then credit the publisher
  // only their share after the platform cut. Never throws, matching
  // billClick's own contract: a credit failure here is logged for manual
  // reconciliation rather than propagated, since the advertiser has already
  // been charged by the time this runs.
  async creditPublisherShare(
    publisherId: string,
    fullAmount: number,
    referenceId: string,
    description: string,
  ): Promise<void> {
    const feeBps = await this.platformSettingsService.getPlatformFeeBps();
    const publisherAmount = this.platformSettingsService.publisherShareOf(
      fullAmount,
      feeBps,
    );

    // A 100% (or near-100%) platform fee can round a tiny bid down to
    // $0.00, which WalletManager rejects (amounts must be > 0) - nothing to
    // credit in that case, and nothing wrong either, so skip rather than
    // let it fall into the catch below as if it were a real failure.
    if (publisherAmount.lessThanOrEqualTo(0)) {
      return;
    }

    try {
      await this.walletManager.creditPublisherEarning(
        publisherId,
        publisherAmount,
        { referenceId, description },
      );
    } catch (error) {
      if (this.isDuplicateTransaction(error)) {
        return;
      }

      // The advertiser has already been charged at this point - this needs
      // a human to reconcile rather than silently losing the publisher's
      // earning, so log at error level instead of warn.
      this.logger.error(
        `Publisher credit failed for ${referenceId} (publisher ${publisherId}) after the advertiser was already charged - needs manual reconciliation: ${this.describe(error)}`,
      );
    }
  }

  private isDuplicateTransaction(error: unknown): boolean {
    return (
      error instanceof ConflictException &&
      error.message === 'DUPLICATE_TRANSACTION'
    );
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
