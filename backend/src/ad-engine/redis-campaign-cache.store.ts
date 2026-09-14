import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import {
  CacheableCampaign,
  CampaignCacheRecord,
  CampaignCacheStore,
  ParsedCampaignCacheRecord,
} from './campaign-cache.types';
import { RedisRespClient } from './redis-resp.client';
import { resolveRedisConnectionOptions } from '../config/env';

export const ACTIVE_CAMPAIGNS_SET_KEY = 'adengine:active_campaigns';
export const campaignCacheKey = (campaignId: string) =>
  `adengine:campaign:${campaignId}`;

@Injectable()
export class RedisCampaignCacheStore
  implements CampaignCacheStore, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCampaignCacheStore.name);

  private readonly redis = new RedisRespClient({
    ...resolveRedisConnectionOptions(),
  });

  async replaceActiveCampaigns(campaigns: CacheableCampaign[]) {
    const existingCampaignIds =
      (await this.redis.command<string[]>([
        'SMEMBERS',
        ACTIVE_CAMPAIGNS_SET_KEY,
      ])) ?? [];
    const nextCampaignIds = new Set(campaigns.map((campaign) => campaign.id));

    for (const campaignId of existingCampaignIds) {
      if (!nextCampaignIds.has(campaignId)) {
        await this.redis.command(['DEL', campaignCacheKey(campaignId)]);
      }
    }

    await this.redis.command(['DEL', ACTIVE_CAMPAIGNS_SET_KEY]);

    for (const campaign of campaigns) {
      const record = this.serializeCampaign(campaign);
      const entries = Object.entries(record).flatMap(([field, value]) => [
        field,
        value,
      ]);

      await this.redis.command([
        'HSET',
        campaignCacheKey(campaign.id),
        ...entries,
      ]);
      await this.redis.command(['SADD', ACTIVE_CAMPAIGNS_SET_KEY, campaign.id]);
    }
  }

  async getActiveCampaigns(): Promise<ParsedCampaignCacheRecord[]> {
    // Fails to an empty list (no campaigns eligible -> /serve responds with
    // "no ad", not a 500) rather than throwing - this is called on every
    // single /serve request, so a Redis outage/quota exhaustion must
    // degrade to "no fill" rather than take down ad serving entirely. See
    // RedisVelocityCounterStore for the fuller reasoning.
    try {
      const campaignIds =
        (await this.redis.command<string[]>([
          'SMEMBERS',
          ACTIVE_CAMPAIGNS_SET_KEY,
        ])) ?? [];
      const campaigns: ParsedCampaignCacheRecord[] = [];

      for (const campaignId of campaignIds) {
        const values =
          (await this.redis.command<string[]>([
            'HGETALL',
            campaignCacheKey(campaignId),
          ])) ?? [];
        const record = this.parseHash(values);

        if (record) {
          campaigns.push(record);
        }
      }

      return campaigns;
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

  private serializeCampaign(campaign: CacheableCampaign): CampaignCacheRecord {
    return {
      id: campaign.id,
      advertiserId: campaign.advertiserId,
      campaignName: campaign.campaignName,
      totalBudget: campaign.totalBudget.toString(),
      dailyBudget: campaign.dailyBudget.toString(),
      maxCpc: campaign.maxCpc.toString(),
      maxCpm:
        campaign.maxCpm != null ? campaign.maxCpm.toString() : '',
      maxCpa:
        campaign.maxCpa != null ? campaign.maxCpa.toString() : '',
      targetCountries: JSON.stringify(campaign.targetCountries),
      targetDevices: JSON.stringify(campaign.targetDevices),
      status: campaign.status,
      advertiserBalanceUsd: campaign.advertiserBalanceUsd.toString(),
      creativeType: campaign.creativeType,
      creativeUrl: campaign.creativeUrl ?? '',
      creativeHtml: campaign.creativeHtml ?? '',
      destinationUrl: campaign.destinationUrl ?? '',
      adFormat: campaign.adFormat ?? '',
      frequencyCapImpressions:
        campaign.frequencyCapImpressions != null
          ? String(campaign.frequencyCapImpressions)
          : '',
      frequencyCapWindowSeconds:
        campaign.frequencyCapWindowSeconds != null
          ? String(campaign.frequencyCapWindowSeconds)
          : '',
    };
  }

  private parseHash(values: string[]): ParsedCampaignCacheRecord | null {
    if (values.length === 0) {
      return null;
    }

    const record: Partial<CampaignCacheRecord> = {};

    for (let index = 0; index < values.length; index += 2) {
      record[values[index] as keyof CampaignCacheRecord] = values[index + 1];
    }

    if (!record.id) {
      return null;
    }

    return {
      id: record.id,
      advertiserId: record.advertiserId ?? '',
      campaignName: record.campaignName ?? '',
      totalBudget: Number(record.totalBudget ?? 0),
      dailyBudget: Number(record.dailyBudget ?? 0),
      maxCpc: Number(record.maxCpc ?? 0),
      maxCpm: record.maxCpm ? Number(record.maxCpm) : null,
      maxCpa: record.maxCpa ? Number(record.maxCpa) : null,
      targetCountries: this.parseJsonArray(record.targetCountries),
      targetDevices: this.parseJsonArray(record.targetDevices),
      status: record.status ?? '',
      advertiserBalanceUsd: Number(record.advertiserBalanceUsd ?? 0),
      creativeType: record.creativeType ?? '',
      creativeUrl: record.creativeUrl || null,
      creativeHtml: record.creativeHtml || null,
      destinationUrl: record.destinationUrl || null,
      adFormat: record.adFormat || null,
      frequencyCapImpressions: record.frequencyCapImpressions
        ? Number(record.frequencyCapImpressions)
        : null,
      frequencyCapWindowSeconds: record.frequencyCapWindowSeconds
        ? Number(record.frequencyCapWindowSeconds)
        : null,
    };
  }

  private parseJsonArray(value?: string): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
}
