import { Injectable, OnModuleDestroy } from '@nestjs/common';

import {
  CacheableCampaign,
  CampaignCacheRecord,
  CampaignCacheStore,
  ParsedCampaignCacheRecord,
} from './campaign-cache.types';
import { RedisRespClient } from './redis-resp.client';

export const ACTIVE_CAMPAIGNS_SET_KEY = 'adengine:active_campaigns';
export const campaignCacheKey = (campaignId: string) =>
  `adengine:campaign:${campaignId}`;

@Injectable()
export class RedisCampaignCacheStore
  implements CampaignCacheStore, OnModuleDestroy
{
  private readonly redis = new RedisRespClient({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
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
      targetCountries: JSON.stringify(campaign.targetCountries),
      targetDevices: JSON.stringify(campaign.targetDevices),
      status: campaign.status,
      advertiserBalanceUsd: campaign.advertiserBalanceUsd.toString(),
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
      targetCountries: this.parseJsonArray(record.targetCountries),
      targetDevices: this.parseJsonArray(record.targetDevices),
      status: record.status ?? '',
      advertiserBalanceUsd: Number(record.advertiserBalanceUsd ?? 0),
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
