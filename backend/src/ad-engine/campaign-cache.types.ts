import { Prisma } from '@prisma/client';

export type CacheableCampaign = {
  id: string;
  advertiserId: string;
  campaignName: string;
  totalBudget: Prisma.Decimal | number | string;
  dailyBudget: Prisma.Decimal | number | string;
  maxCpc: Prisma.Decimal | number | string;
  targetCountries: string[];
  targetDevices: string[];
  status: string;
  advertiserBalanceUsd: Prisma.Decimal | number | string;
  creativeType: string;
  creativeUrl: string | null;
  creativeHtml: string | null;
  // Optional (rather than string | null like the fields above) purely so
  // existing call sites/fixtures built before this field existed don't need
  // updating - every real row from CampaignCacheSyncService's query has it.
  destinationUrl?: string | null;
};

export type CampaignCacheRecord = {
  id: string;
  advertiserId: string;
  campaignName: string;
  totalBudget: string;
  dailyBudget: string;
  maxCpc: string;
  targetCountries: string;
  targetDevices: string;
  status: string;
  advertiserBalanceUsd: string;
  creativeType: string;
  creativeUrl: string;
  creativeHtml: string;
  destinationUrl?: string;
};

export type ParsedCampaignCacheRecord = {
  id: string;
  advertiserId: string;
  campaignName: string;
  totalBudget: number;
  dailyBudget: number;
  maxCpc: number;
  targetCountries: string[];
  targetDevices: string[];
  status: string;
  advertiserBalanceUsd: number;
  creativeType: string;
  creativeUrl: string | null;
  creativeHtml: string | null;
  destinationUrl?: string | null;
};

export interface CampaignCacheStore {
  replaceActiveCampaigns(campaigns: CacheableCampaign[]): Promise<void>;
  getActiveCampaigns(): Promise<ParsedCampaignCacheRecord[]>;
}
