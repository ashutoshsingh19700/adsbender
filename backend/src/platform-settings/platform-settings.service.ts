import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AD_FORMATS } from '../common/ad-formats';

export const DEFAULT_PLATFORM_FEE_BPS = 2000; // 20.00%
export const PLATFORM_SETTING_ID = 'default';
const CACHE_TTL_MS = 30_000;

export type AdFormatRate = { cpm: number; cpa: number; cpc: number };
export type AdFormatPricing = Record<string, AdFormatRate>;

// Starting rate card, in dollars - an admin can override any entry via
// PATCH /admin/settings/ad-format-pricing without a redeploy. Only what's
// actually stored in PlatformSetting.adFormatPricing overrides these; any
// format missing from the stored JSON (including a brand-new one added to
// AD_FORMATS later) still resolves to its default here.
export const DEFAULT_AD_FORMAT_PRICING: AdFormatPricing = {
  POPUNDER: { cpm: 2.5, cpa: 6, cpc: 0.35 },
  SOCIAL_BAR: { cpm: 2.0, cpa: 5, cpc: 0.3 },
  NATIVE_BANNER: { cpm: 1.5, cpa: 4, cpc: 0.2 },
  IN_PAGE_PUSH: { cpm: 1.8, cpa: 4.5, cpc: 0.25 },
  INTERSTITIAL: { cpm: 3, cpa: 7, cpc: 0.4 },

  BANNER_728X90: { cpm: 1.2, cpa: 3.5, cpc: 0.15 },
  LEADERBOARD: { cpm: 1.4, cpa: 3.8, cpc: 0.18 },
  MEDIUM_RECTANGLE_300X250: { cpm: 1.3, cpa: 3.6, cpc: 0.16 },
  LARGE_RECTANGLE_336X280: { cpm: 1.35, cpa: 3.7, cpc: 0.17 },
  STICKY_BANNER: { cpm: 1.5, cpa: 4, cpc: 0.2 },

  SKYSCRAPER_160X600: { cpm: 1.1, cpa: 3.2, cpc: 0.14 },
  WIDE_SKYSCRAPER_300X600: { cpm: 1.25, cpa: 3.4, cpc: 0.16 },
  STICKY_SIDEBAR: { cpm: 1.3, cpa: 3.5, cpc: 0.17 },
  FLOATING_SIDEBAR: { cpm: 1.35, cpa: 3.6, cpc: 0.18 },

  IN_ARTICLE: { cpm: 1.6, cpa: 4.2, cpc: 0.22 },
  IN_FEED: { cpm: 1.55, cpa: 4.1, cpc: 0.21 },
  RECOMMENDED_CONTENT: { cpm: 1.5, cpa: 4, cpc: 0.2 },
  SPONSORED_WIDGET: { cpm: 1.65, cpa: 4.3, cpc: 0.23 },

  POPUP: { cpm: 2.2, cpa: 5.5, cpc: 0.32 },
  EXIT_INTENT_POPUP: { cpm: 2.4, cpa: 5.8, cpc: 0.34 },
  FLOATING_OVERLAY: { cpm: 1.9, cpa: 4.8, cpc: 0.28 },
  WELCOME_SCREEN: { cpm: 2.1, cpa: 5.2, cpc: 0.3 },

  PAGE_TRANSITION_INTERSTITIAL: { cpm: 2.8, cpa: 6.5, cpc: 0.38 },

  PRE_ROLL: { cpm: 4, cpa: 8, cpc: 0.5 },
  MID_ROLL: { cpm: 4.2, cpa: 8.2, cpc: 0.52 },
  POST_ROLL: { cpm: 3.5, cpa: 7.5, cpc: 0.45 },
  VIDEO_OVERLAY: { cpm: 3.2, cpa: 7.2, cpc: 0.42 },

  HOMEPAGE_HERO_BANNER: { cpm: 5, cpa: 10, cpc: 0.6 },
  NEWSLETTER_SPONSORSHIP: { cpm: 4.5, cpa: 9.5, cpc: 0.55 },
  SPONSORED_BLOG_POST: { cpm: 3.8, cpa: 8.5, cpc: 0.48 },
  SPONSORED_SECTION: { cpm: 4.2, cpa: 9, cpc: 0.52 },
  STICKY_BOTTOM_BANNER: { cpm: 1.6, cpa: 4.2, cpc: 0.22 },
  FLOATING_CORNER_AD: { cpm: 1.7, cpa: 4.4, cpc: 0.24 },
};

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

  private cachedPricing: AdFormatPricing | null = null;
  private cachedPricingAt = 0;

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

  // Merges any admin overrides on top of DEFAULT_AD_FORMAT_PRICING so every
  // known ad format always resolves to a full { cpm, cpa, cpc } rate, even
  // if it's never been individually edited. Cached the same way as the
  // platform fee - read on the advertiser-facing pricing endpoint and the
  // campaign wizard, not a hot billing path, but no reason to hit Postgres
  // on every page load either.
  async getAdFormatPricing(): Promise<AdFormatPricing> {
    const now = Date.now();

    if (
      this.cachedPricing !== null &&
      now - this.cachedPricingAt < CACHE_TTL_MS
    ) {
      return this.cachedPricing;
    }

    const setting = await this.prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
    });
    const overrides =
      (setting?.adFormatPricing as AdFormatPricing | null) ?? {};

    const merged: AdFormatPricing = { ...DEFAULT_AD_FORMAT_PRICING };
    for (const format of Object.keys(overrides)) {
      merged[format] = { ...merged[format], ...overrides[format] };
    }

    this.cachedPricing = merged;
    this.cachedPricingAt = now;

    return merged;
  }

  // Replaces the stored override for ONE ad format (not the whole rate
  // card) so an admin editing one row can never accidentally wipe out
  // every other format's override in the same request.
  async updateAdFormatPricing(
    adFormat: string,
    rate: AdFormatRate,
  ): Promise<AdFormatPricing> {
    if (!AD_FORMATS.includes(adFormat as (typeof AD_FORMATS)[number])) {
      throw new BadRequestException(`Unknown ad format: ${adFormat}`);
    }
    for (const [key, value] of Object.entries(rate)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new BadRequestException(
          `${key} must be a non-negative number`,
        );
      }
    }

    const setting = await this.prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
    });
    const existingOverrides =
      (setting?.adFormatPricing as AdFormatPricing | null) ?? {};
    const nextOverrides: AdFormatPricing = {
      ...existingOverrides,
      [adFormat]: rate,
    };

    await this.prisma.platformSetting.upsert({
      where: { id: PLATFORM_SETTING_ID },
      update: { adFormatPricing: nextOverrides },
      create: { id: PLATFORM_SETTING_ID, adFormatPricing: nextOverrides },
    });

    // Invalidate rather than recompute in place - getAdFormatPricing()'s
    // merge-with-defaults logic is the single source of truth for the
    // resulting shape.
    this.cachedPricing = null;
    this.cachedPricingAt = 0;

    return this.getAdFormatPricing();
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
