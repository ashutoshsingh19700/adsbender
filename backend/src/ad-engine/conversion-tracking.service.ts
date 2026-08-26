import { Injectable, Logger } from '@nestjs/common';

import { AdBillingService } from './ad-billing.service';
import { PrismaService } from '../prisma/prisma.service';

export type ConversionResult = {
  recorded: boolean;
  reason?: 'CLICK_NOT_FOUND' | 'ALREADY_CONVERTED';
};

// Server-to-server conversion postbacks are the standard way an ad network
// finds out something happened on the ADVERTISER's own site (a purchase,
// a signup) after a click - we have no visibility into that page ourselves.
// The click_id embedded in the click-tracking redirect (see
// AdEngineController.buildClickUrl) is the only link between "someone
// clicked this ad" and "that click later converted".
@Injectable()
export class ConversionTrackingService {
  private readonly logger = new Logger(ConversionTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adBillingService: AdBillingService,
  ) {}

  // Called from AdEngineController.click for a CPA-priced campaign only -
  // creates the row a later conversion postback will claim. Never throws:
  // a failed tracking write must not break the visitor's actual click
  // redirect, it just means a conversion postback for this click will 404
  // later (a self-explanatory, debuggable failure mode for the advertiser
  // integrating the postback, rather than a broken user-facing redirect).
  async recordClick(
    clickId: string,
    campaignId: string,
    zoneId: string,
  ): Promise<void> {
    try {
      await this.prisma.adClick.create({
        data: { id: clickId, campaignId, zoneId },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record click ${clickId} for campaign ${campaignId}: ${this.describe(error)}`,
      );
    }
  }

  // Called from GET /api/v1/conversion. Postback URLs are notoriously
  // unreliable/retry-happy on the advertiser's side, so this is
  // deliberately idempotent and lenient rather than throwing on a
  // duplicate - a replayed postback for the same clickId is a no-op, not
  // an error.
  async recordConversion(
    clickId: string,
    conversionValue?: number,
  ): Promise<ConversionResult> {
    // Atomic claim (not "read then write") - two near-simultaneous
    // postbacks for the same clickId must not both succeed and double-bill
    // the advertiser. Only the request whose UPDATE actually matches a row
    // still having convertedAt: null wins the claim; the loser sees
    // count: 0 and is treated as a harmless duplicate below.
    const claim = await this.prisma.adClick.updateMany({
      where: { id: clickId, convertedAt: null },
      data: {
        convertedAt: new Date(),
        conversionValue,
      },
    });

    if (claim.count === 0) {
      const existing = await this.prisma.adClick.findUnique({
        where: { id: clickId },
      });

      return {
        recorded: false,
        reason: existing ? 'ALREADY_CONVERTED' : 'CLICK_NOT_FOUND',
      };
    }

    const click = await this.prisma.adClick.findUnique({
      where: { id: clickId },
      select: { campaignId: true, zoneId: true },
    });

    // Can't actually happen (the claim above just succeeded against this
    // exact row), but keeps this from ever throwing on a null-assertion.
    if (!click) {
      return { recorded: true };
    }

    await this.billConversion(click.campaignId, click.zoneId, clickId);

    return { recorded: true };
  }

  private async billConversion(
    campaignId: string,
    zoneId: string,
    clickId: string,
  ): Promise<void> {
    const [campaign, zone] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { maxCpa: true },
      }),
      this.prisma.adZone.findUnique({
        where: { id: zoneId },
        select: { publisherId: true },
      }),
    ]);

    // Campaign or zone could have been deleted since the click happened -
    // the conversion is still correctly recorded on AdClick above (that's
    // the honest record of what happened), it just can't be billed.
    if (!campaign?.maxCpa || !zone) {
      this.logger.warn(
        `Conversion ${clickId} recorded but not billed: campaign ${campaignId} has no maxCpa or zone ${zoneId} is gone`,
      );
      return;
    }

    await this.adBillingService.billConversion(
      campaignId,
      zone.publisherId,
      Number(campaign.maxCpa),
      `conversion:${clickId}`,
    );
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
