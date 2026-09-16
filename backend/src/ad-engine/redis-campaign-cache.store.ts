import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import {
  CacheableCampaign,
  CampaignCacheStore,
  ParsedCampaignCacheRecord,
} from './campaign-cache.types';
import { RedisRespClient } from './redis-resp.client';
import { resolveRedisConnectionOptions } from '../config/env';

export const ACTIVE_CAMPAIGNS_KEY = 'adengine:active_campaigns';

@Injectable()
export class RedisCampaignCacheStore
  implements CampaignCacheStore, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCampaignCacheStore.name);

  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  // The whole active-campaign list is written/read as a single JSON blob
  // under one key (1 Redis command either way) instead of a membership set
  // plus one hash per campaign (1 + N commands either way). getActiveCampaigns
  // runs on every single /serve request, so the per-campaign version billed
  // N+1 commands per ad request - this collapses it to O(1) regardless of
  // how many campaigns are active.
  async replaceActiveCampaigns(campaigns: CacheableCampaign[]) {
    const records = campaigns.map((campaign) => this.serializeCampaign(campaign));

    await this.redis.command(['SET', ACTIVE_CAMPAIGNS_KEY, JSON.stringify(records)]);
  }

  async getActiveCampaigns(): Promise<ParsedCampaignCacheRecord[]> {
    // Fails to an empty list (no campaigns eligible -> /serve responds with
    // "no ad", not a 500) rather than throwing - this is called on every
    // single /serve request, so a Redis outage/quota exhaustion must
    // degrade to "no fill" rather than take down ad serving entirely. See
    // RedisVelocityCounterStore for the fuller reasoning.
    try {
      const raw = await this.redis.command<string | null>([
        'GET',
        ACTIVE_CAMPAIGNS_KEY,
      ]);

      if (!raw) {
        return [];
      }

      return JSON.parse(raw) as ParsedCampaignCacheRecord[];
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for active campaign cache - reporting no eligible campaigns: ${(error as Error).message}`,
      );
      return [];
    }
  }

  onModuleDestroy() {
    this.redis.destroy();
  }

  private serializeCampaign(
    campaign: CacheableCampaign,
  ): ParsedCampaignCacheRecord {
    return {
      id: campaign.id,
      advertiserId: campaign.advertiserId,
      campaignName: campaign.campaignName,
      totalBudget: Number(campaign.totalBudget),
      dailyBudget: Number(campaign.dailyBudget),
      maxCpc: Number(campaign.maxCpc),
      maxCpm: campaign.maxCpm != null ? Number(campaign.maxCpm) : null,
      maxCpa: campaign.maxCpa != null ? Number(campaign.maxCpa) : null,
      targetCountries: campaign.targetCountries,
      targetDevices: campaign.targetDevices,
      status: campaign.status,
      advertiserBalanceUsd: Number(campaign.advertiserBalanceUsd),
      creativeType: campaign.creativeType,
      creativeUrl: campaign.creativeUrl,
      creativeHtml: campaign.creativeHtml,
      destinationUrl: campaign.destinationUrl ?? null,
      adFormat: campaign.adFormat ?? null,
      frequencyCapImpressions: campaign.frequencyCapImpressions ?? null,
      frequencyCapWindowSeconds: campaign.frequencyCapWindowSeconds ?? null,
    };
  }
}
