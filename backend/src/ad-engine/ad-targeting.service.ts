import { Inject, Injectable } from '@nestjs/common';

import { CAMPAIGN_CACHE_STORE } from './campaign-cache-sync.service';
import type {
  CampaignCacheStore,
  ParsedCampaignCacheRecord,
} from './campaign-cache.types';
import { PrismaService } from '../prisma/prisma.service';

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
    private readonly prisma: PrismaService,
  ) {}

  async selectCampaign(request: TargetingRequest) {
    // zoneId is client-suppliable (see AdEngineController.serve) and was
    // previously only ever threaded through to the response/impression
    // event, never checked against a real zone - any string, including a
    // paused or nonexistent zone's id, would still serve a live campaign.
    // Confirm the zone exists and is ACTIVE before spending any targeting
    // effort on it.
    const zone = await this.prisma.adZone
      .findUnique({
        where: { id: request.zoneId },
        select: { status: true },
      })
      // A malformed zoneId (not a UUID at all - e.g. a stale/hand-typed
      // integration) fails Postgres's uuid cast rather than just missing a
      // row. Either way there's no real zone behind it, so treat it the
      // same as "not found" instead of surfacing a 500.
      .catch(() => null);

    if (!zone || zone.status !== 'ACTIVE') {
      return null;
    }

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
