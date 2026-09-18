import { Prisma } from '@prisma/client';

export type CacheableCampaign = {
  id: string;
  advertiserId: string;
  campaignName: string;
  totalBudget: Prisma.Decimal | number | string;
  dailyBudget: Prisma.Decimal | number | string;
  maxCpc: Prisma.Decimal | number | string;
  // Bid per 1000 impressions - see Campaign.maxCpm in schema.prisma.
  // Optional/nullable, same reasoning as destinationUrl below: existing
  // call sites/fixtures built before this field existed don't need
  // updating, and a real row can also explicitly have no CPM bid.
  maxCpm?: Prisma.Decimal | number | string | null;
  // Bid per verified conversion - see Campaign.maxCpa in schema.prisma.
  // Same optional/nullable reasoning as maxCpm above.
  maxCpa?: Prisma.Decimal | number | string | null;
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
  // The format this campaign was built for (see CampaignAdFormat in
  // schema.prisma) - AdTargetingService.isEligible matches this against the
  // serving zone's layoutType. Optional/nullable so a campaign created
  // before this feature existed stays wildcard-eligible - see isEligible.
  adFormat?: string | null;
  // Content category (see Campaign.category in schema.prisma) -
  // AdTargetingService.isEligible matches this against the serving zone's
  // allowedCategories, when the zone has any. Optional/nullable so a
  // campaign created before this feature existed stays wildcard-eligible.
  category?: string | null;
  // Per-campaign frequency-cap override (see Campaign.frequencyCapImpressions
  // in schema.prisma). Optional/nullable - undefined or null both mean "use
  // VisitorFrequencyCapService's platform default", not "uncapped".
  frequencyCapImpressions?: number | null;
  frequencyCapWindowSeconds?: number | null;
};

export type ParsedCampaignCacheRecord = {
  id: string;
  advertiserId: string;
  campaignName: string;
  totalBudget: number;
  dailyBudget: number;
  maxCpc: number;
  maxCpm?: number | null;
  maxCpa?: number | null;
  targetCountries: string[];
  targetDevices: string[];
  status: string;
  advertiserBalanceUsd: number;
  creativeType: string;
  creativeUrl: string | null;
  creativeHtml: string | null;
  destinationUrl?: string | null;
  adFormat?: string | null;
  category?: string | null;
  frequencyCapImpressions?: number | null;
  frequencyCapWindowSeconds?: number | null;
};

export interface CampaignCacheStore {
  replaceActiveCampaigns(campaigns: CacheableCampaign[]): Promise<void>;
  getActiveCampaigns(): Promise<ParsedCampaignCacheRecord[]>;
}
