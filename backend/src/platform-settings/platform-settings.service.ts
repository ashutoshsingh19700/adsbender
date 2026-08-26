import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_PLATFORM_FEE_BPS = 2000; // 20.00%
export const PLATFORM_SETTING_ID = 'default';
const CACHE_TTL_MS = 30_000;

// Network-wide runtime config (currently just the platform revenue cut),
// admin-adjustable without a redeploy. Read on the hot path of every
// impression/click billed (see AdBillingService), so the current value is
// cached in-process for a short window rather than hitting Postgres on
// every single billing event - an admin's rate change takes up to
// CACHE_TTL_MS to actually apply, which is an acceptable trade for not
// adding a DB round trip to every ad billed.
@Injectable()
export class PlatformSettingsService {
  private cachedFeeBps: number | null = null;
  private cachedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async getPlatformFeeBps(): Promise<number> {
    const now = Date.now();

    if (this.cachedFeeBps !== null && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedFeeBps;
    }

    const setting = await this.prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
    });
    const feeBps = setting?.platformFeeBps ?? DEFAULT_PLATFORM_FEE_BPS;

    this.cachedFeeBps = feeBps;
    this.cachedAt = now;

    return feeBps;
  }

  async updatePlatformFeeBps(feeBps: number): Promise<{ platformFeeBps: number }> {
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
      throw new BadRequestException(
        'platformFeeBps must be an integer between 0 and 10000',
      );
    }

    const updated = await this.prisma.platformSetting.upsert({
      where: { id: PLATFORM_SETTING_ID },
      update: { platformFeeBps: feeBps },
      create: { id: PLATFORM_SETTING_ID, platformFeeBps: feeBps },
    });

    // Update the cache immediately rather than waiting for it to expire -
    // an admin who just changed the rate should see it take effect right
    // away, not up to CACHE_TTL_MS later.
    this.cachedFeeBps = updated.platformFeeBps;
    this.cachedAt = Date.now();

    return { platformFeeBps: updated.platformFeeBps };
  }

  // Advertiser is always charged the full `amount` - this is only what the
  // PUBLISHER gets credited after the platform's cut. Rounded to 2dp
  // (half-up) because every amount that reaches WalletManager must be an
  // exact cent value - see WalletManager.normalizeAmount.
  publisherShareOf(
    amount: Prisma.Decimal | number | string,
    feeBps: number,
  ): Prisma.Decimal {
    const rate = new Prisma.Decimal(10_000 - feeBps).dividedBy(10_000);

    return new Prisma.Decimal(amount)
      .times(rate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
}
