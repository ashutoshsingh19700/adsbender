import { Inject, Injectable } from '@nestjs/common';

import { BLACKLIST_CACHE_STORE } from './blacklist-cache-sync.service';
import type { BlacklistCacheStore } from './blacklist-cache.types';
import { ClickIntegrityService } from './click-integrity.service';
import { DatacenterIpService } from './datacenter-ip.service';
import { FrequencyCappingService } from './frequency-capping.service';
import { PrismaService } from '../prisma/prisma.service';

export type FraudDecision = {
  blocked: boolean;
  reason?: string;
  // Set when the request was allowed through but still looked suspicious
  // enough to be worth recording for analytics (e.g. a datacenter IP on a
  // non-billable impression) - see AdEngineController, which logs this to
  // the traffic_events ClickHouse table either way.
  flagged?: boolean;
};

export type ClickEvaluationContext = {
  zoneId: string;
  campaignId: string;
  // The `t` query param AdEngineController.buildClickUrl signs into every
  // creative's click URL at /serve time - see ClickIntegrityService.
  clickToken?: string;
  // Whether this click will actually cost the advertiser money (a CPC
  // campaign) - see AdEngineController.isCpmCampaign/isCpaCampaign. A
  // non-billable click (CPM/CPA) still gets the same checks recorded for
  // analytics, but a failed check only BLOCKS the ones that would otherwise
  // move money.
  billable: boolean;
};

@Injectable()
export class FraudDetectionService {
  private readonly blockedUserAgentPatterns = [
    /curl/i,
    /python-requests/i,
    /headlesschrome/i,
    /phantomjs/i,
    /selenium/i,
    /playwright/i,
    /puppeteer/i,
  ];

  private readonly blockDatacenterIpClicks =
    process.env.BLOCK_DATACENTER_IP_CLICKS !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly frequencyCappingService: FrequencyCappingService,
    private readonly clickIntegrityService: ClickIntegrityService,
    private readonly datacenterIpService: DatacenterIpService,
    @Inject(BLACKLIST_CACHE_STORE)
    private readonly blacklistCacheStore: BlacklistCacheStore,
  ) {}

  async evaluateServeRequest(
    ipAddress: string,
    userAgent?: string,
  ): Promise<FraudDecision> {
    const baseDecision = await this.evaluateBotAndBlacklist(
      ipAddress,
      userAgent,
    );

    if (baseDecision.blocked) {
      return baseDecision;
    }

    const frequencyCap = await this.frequencyCappingService.evaluateImpression(
      this.normalizeIp(ipAddress),
    );

    if (!frequencyCap.allowed) {
      return {
        blocked: true,
        reason: frequencyCap.reason,
      };
    }

    // A datacenter/hosting IP never blocks an impression outright - plenty
    // of real people browse through corporate VPNs and proxies that live in
    // the same ranges, and refusing to even SHOW an ad there would cost a
    // publisher legitimate revenue. It's still worth recording (see
    // AdEngineController), and it feeds the click-time decision below.
    if (this.datacenterIpService.isDatacenterIp(this.normalizeIp(ipAddress))) {
      return { blocked: false, flagged: true, reason: 'DATACENTER_IP' };
    }

    return {
      blocked: false,
    };
  }

  async evaluateClickRequest(
    ipAddress: string,
    userAgent?: string,
    context?: ClickEvaluationContext,
  ): Promise<FraudDecision> {
    const baseDecision = await this.evaluateBotAndBlacklist(
      ipAddress,
      userAgent,
    );

    if (baseDecision.blocked) {
      return baseDecision;
    }

    const frequencyCap = await this.frequencyCappingService.evaluateClick(
      this.normalizeIp(ipAddress),
    );

    if (!frequencyCap.allowed) {
      return {
        blocked: true,
        reason: frequencyCap.reason,
      };
    }

    if (context) {
      // Proves this click followed a real /serve response for this exact
      // zone+campaign (see ClickIntegrityService) rather than a script
      // hitting /api/v1/click directly with a guessed/replayed URL - the
      // single most direct defense against "just click the ad a bunch of
      // times to run up the advertiser's bill" abuse. Only enforced (i.e.
      // BLOCKS) when the click is actually billable; a non-billable
      // CPM/CPA click still gets the outcome recorded for analytics.
      const tokenVerification = this.clickIntegrityService.verify(
        context.clickToken,
        context.zoneId,
        context.campaignId,
      );

      if (!tokenVerification.valid) {
        if (context.billable) {
          return { blocked: true, reason: tokenVerification.reason };
        }

        return { blocked: false, flagged: true, reason: tokenVerification.reason };
      }

      if (this.datacenterIpService.isDatacenterIp(this.normalizeIp(ipAddress))) {
        if (context.billable && this.blockDatacenterIpClicks) {
          return { blocked: true, reason: 'DATACENTER_IP_CLICK' };
        }

        return { blocked: false, flagged: true, reason: 'DATACENTER_IP' };
      }
    }

    return {
      blocked: false,
    };
  }

  private async evaluateBotAndBlacklist(
    ipAddress: string,
    userAgent?: string,
  ): Promise<FraudDecision> {
    const normalizedIp = this.normalizeIp(ipAddress);
    // Reads the Redis-cached blacklist set (see BlacklistCacheSyncService)
    // instead of a Postgres lookup on every single /serve and /click
    // request - this ran unconditionally on the hottest path in the app,
    // for a check that's almost always a miss (most IPs are never
    // blacklisted). recordHoneypotHit below still writes straight to
    // Postgres; the cache picks it up on its next periodic sync.
    const isBlacklisted =
      await this.blacklistCacheStore.isBlacklisted(normalizedIp);

    if (isBlacklisted) {
      return {
        blocked: true,
        reason: 'IP_BLACKLISTED',
      };
    }

    if (!userAgent || userAgent.trim().length === 0) {
      return {
        blocked: true,
        reason: 'MISSING_USER_AGENT',
      };
    }

    if (
      this.blockedUserAgentPatterns.some((pattern) => pattern.test(userAgent))
    ) {
      return {
        blocked: true,
        reason: 'SUSPICIOUS_USER_AGENT',
      };
    }

    return {
      blocked: false,
    };
  }

  async recordHoneypotHit(ipAddress: string, userAgent?: string) {
    const normalizedIp = this.normalizeIp(ipAddress);

    return this.prisma.blacklistedIp.upsert({
      where: { ipAddress: normalizedIp },
      update: {
        source: 'HONEYPOT',
        reason: this.formatReason(userAgent),
      },
      create: {
        ipAddress: normalizedIp,
        source: 'HONEYPOT',
        reason: this.formatReason(userAgent),
      },
    });
  }

  normalizeIp(ipAddress: string) {
    return ipAddress.replace('::ffff:', '').split(',')[0].trim();
  }

  private formatReason(userAgent?: string) {
    return userAgent
      ? `Hidden honeypot link requested by ${userAgent}`
      : 'Hidden honeypot link requested';
  }
}
