import { ConflictException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WalletManager } from '../wallet/wallet-manager.service';
import type { ClickEvent } from './ad-event.types';

// Turns a delivered click into real money movement. Impressions are billing
// -neutral (analytics only) - Campaign only has `maxCpc` (no CPM field), so
// this is a pure CPC model: the advertiser is charged, and the serving
// zone's publisher is credited, only when a click actually happens.
//
// No platform revenue share is modeled anywhere in the schema yet, so the
// publisher currently gets 100% pass-through of what the advertiser pays.
@Injectable()
export class AdBillingService {
  private readonly logger = new Logger(AdBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletManager: WalletManager,
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

    try {
      await this.walletManager.creditPublisherEarning(zone.publisherId, event.cost, {
        referenceId,
        description: `Click on zone ${event.zone}`,
      });
    } catch (error) {
      if (this.isDuplicateTransaction(error)) {
        return;
      }

      // The advertiser has already been charged at this point - this needs
      // a human to reconcile rather than silently losing the publisher's
      // earning, so log at error level instead of warn.
      this.logger.error(
        `Publisher credit failed for click ${referenceId} (zone ${event.zone}) after the advertiser was already charged - needs manual reconciliation: ${this.describe(error)}`,
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
