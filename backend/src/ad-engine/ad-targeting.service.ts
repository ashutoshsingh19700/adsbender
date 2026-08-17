import { Inject, Injectable } from '@nestjs/common';

import { CAMPAIGN_CACHE_STORE } from './campaign-cache-sync.service';
import type {
  CampaignCacheStore,
  ParsedCampaignCacheRecord,
} from './campaign-cache.types';

export type TargetingRequest = {
  zoneId: string;
  country: string | null;
  device: string;
};

@Injectable()
export class AdTargetingService {
  constructor(
    @Inject(CAMPAIGN_CACHE_STORE)
    private readonly campaignCacheStore: CampaignCacheStore,
  ) {}

  async selectCampaign(request: TargetingRequest) {
    const campaigns = await this.campaignCacheStore.getActiveCampaigns();

    return (
      campaigns
        .filter((campaign) => this.isEligible(campaign, request))
        .sort((left, right) => right.maxCpc - left.maxCpc)[0] ?? null
    );
  }

  private isEligible(
    campaign: ParsedCampaignCacheRecord,
    request: TargetingRequest,
  ) {
    if (campaign.status !== 'ACTIVE') {
      return false;
    }

    if (campaign.advertiserBalanceUsd <= campaign.maxCpc) {
      return false;
    }

    if (
      request.country &&
      campaign.targetCountries.length > 0 &&
      !campaign.targetCountries
        .map((country) => country.toUpperCase())
        .includes(request.country)
    ) {
      return false;
    }

    if (
      campaign.targetDevices.length > 0 &&
      !campaign.targetDevices
        .map((device) => device.toLowerCase())
        .includes(request.device.toLowerCase())
    ) {
      return false;
    }

    return true;
  }
}
