import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type {
  CacheableCampaign,
  CampaignCacheStore,
} from './campaign-cache.types';
import { PrismaService } from '../prisma/prisma.service';

export const CAMPAIGN_CACHE_STORE = Symbol('CAMPAIGN_CACHE_STORE');
export const CAMPAIGN_CACHE_SYNC_INTERVAL_MS = 30_000;

@Injectable()
export class CampaignCacheSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignCacheSyncService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CAMPAIGN_CACHE_STORE)
    private readonly campaignCacheStore: CampaignCacheStore,
  ) {}

  onModuleInit() {
    if (process.env.CAMPAIGN_CACHE_SYNC_ENABLED === 'false') {
      return;
    }

    void this.syncActiveCampaigns();
    this.interval = setInterval(
      () => void this.syncActiveCampaigns(),
      CAMPAIGN_CACHE_SYNC_INTERVAL_MS,
    );
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async syncActiveCampaigns() {
    const campaigns = await this.loadFundedActiveCampaigns();

    await this.campaignCacheStore.replaceActiveCampaigns(campaigns);

    return {
      cachedCampaigns: campaigns.length,
    };
  }

  private async loadFundedActiveCampaigns(): Promise<CacheableCampaign[]> {
    try {
      return await this.prisma.$queryRaw<CacheableCampaign[]>`
        SELECT
          c.id,
          c."advertiserId",
          c."campaignName",
          c."totalBudget",
          c."dailyBudget",
          c."maxCpc",
          c."targetCountries",
          c."targetDevices",
          c.status::text AS status,
          u.balance_usd AS "advertiserBalanceUsd"
        FROM "Campaign" c
        INNER JOIN "User" u ON u.id = c."advertiserId"
        WHERE c.status = 'ACTIVE'
          AND u.balance_usd > c."maxCpc"
      `;
    } catch (error) {
      this.logger.error('Failed to refresh Redis campaign cache', error);
      throw error;
    }
  }
}
