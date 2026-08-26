import { createHash, randomUUID } from 'crypto';

import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpStatus,
  Ip,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { AdEventProducerService } from './ad-event-producer.service';
import { AdTargetingService } from './ad-targeting.service';
import { ConversionTrackingService } from './conversion-tracking.service';
import { DeviceDetectorService } from './device-detector.service';
import { FraudDetectionService } from './fraud-detection.service';
import { GeoIpService } from './geo-ip.service';
import { SiteAutoVerificationService } from './site-auto-verification.service';
import { adServerPublicOrigin } from '../config/env';

@Controller('api/v1')
export class AdEngineController {
  constructor(
    private readonly adTargetingService: AdTargetingService,
    private readonly adEventProducerService: AdEventProducerService,
    private readonly conversionTrackingService: ConversionTrackingService,
    private readonly deviceDetectorService: DeviceDetectorService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly geoIpService: GeoIpService,
    private readonly siteAutoVerificationService: SiteAutoVerificationService,
  ) {}

  @Get('serve')
  async serve(
    @Query('zoneId') zoneId: string,
    @Query('origin') origin: string,
    @Query('path') path: string,
    @Query('viewportWidth') viewportWidth: string,
    @Query('viewportHeight') viewportHeight: string,
    @Query('devicePixelRatio') devicePixelRatio: string,
    @Query('referrer') referrer: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-geo-country') countryHeader: string,
    @Headers('referer') refererHeader: string,
    @Headers('origin') originHeader: string,
    @Ip() ipAddress: string,
  ) {
    const fraudDecision = await this.fraudDetectionService.evaluateServeRequest(
      ipAddress,
      userAgent,
    );

    if (fraudDecision.blocked) {
      throw new ForbiddenException(fraudDecision.reason);
    }

    // Fire-and-forget: derived from the real Referer/Origin HTTP header
    // (not the client-suppliable `origin` query param above), so a request
    // that already cleared fraud detection is trusted to prove the domain
    // it came from. Never awaited - must not add latency or ever fail the
    // ad response itself.
    void this.siteAutoVerificationService.verifyFromRequestHeader({
      zoneId,
      refererHeader,
      originHeader,
    });

    const numericViewportWidth = Number(viewportWidth);
    const numericViewportHeight = Number(viewportHeight);
    const country = this.geoIpService.resolveCountry(ipAddress, countryHeader);
    const device = this.deviceDetectorService.detect(
      userAgent,
      numericViewportWidth,
    );
    const selectedCampaign = await this.adTargetingService.selectCampaign({
      zoneId,
      country,
      device,
      visitorId: this.buildVisitorId(ipAddress, userAgent),
    });

    if (selectedCampaign) {
      const isCpmCampaign = this.isCpmCampaign(selectedCampaign);

      this.adEventProducerService.publishImpression({
        type: 'impression',
        zone: zoneId,
        campaign: selectedCampaign.id,
        advertiser: selectedCampaign.advertiserId,
        // Analytics-only estimate for a CPM campaign (real money bills in
        // lump-sum batches - see CpmBillingService); 0 for a CPC campaign,
        // which is billed on click instead, not on impression.
        cost: isCpmCampaign ? (selectedCampaign.maxCpm as number) / 1000 : 0,
        time: Math.floor(Date.now() / 1000),
        request: {
          origin,
          path,
          country,
          device,
          ipAddress,
          userAgent,
        },
        maxCpm: isCpmCampaign ? (selectedCampaign.maxCpm as number) : undefined,
      });
    }

    return {
      type: 'ad_response',
      zoneId,
      request: {
        origin,
        path,
        viewportWidth: numericViewportWidth,
        viewportHeight: numericViewportHeight,
        devicePixelRatio: Number(devicePixelRatio),
        referrer,
        userAgent,
        ipAddress,
        country,
        device,
      },
      creative: selectedCampaign
        ? {
            campaignId: selectedCampaign.id,
            advertiserId: selectedCampaign.advertiserId,
            campaignName: selectedCampaign.campaignName,
            bidUsd: selectedCampaign.maxCpc,
            html: this.renderCreativeHtml(selectedCampaign, {
              zoneId,
              origin,
              path,
            }),
          }
        : null,
    };
  }

  // Builds the markup the publisher tag drops straight into the zone's
  // <section> via zone.innerHTML - see backend/public/publisher_tag.js.
  // Falls back to the fraud-detection honeypot link (same as an empty zone)
  // if a campaign somehow has no creative content, rather than injecting
  // nothing and leaving the zone silently blank.
  private renderCreativeHtml(
    campaign: {
      id: string;
      advertiserId: string;
      maxCpc: number;
      maxCpm?: number | null;
      maxCpa?: number | null;
      creativeType: string;
      creativeUrl: string | null;
      creativeHtml: string | null;
      destinationUrl?: string | null;
    },
    context: { zoneId: string; origin: string; path: string },
  ): string {
    if (campaign.creativeType === 'html' && campaign.creativeHtml) {
      return campaign.creativeHtml;
    }

    if (campaign.creativeType === 'image' && campaign.creativeUrl) {
      const image = `<img src="${this.escapeHtmlAttribute(campaign.creativeUrl)}" alt="" style="display:block;max-width:100%;height:auto;" />`;

      // No destinationUrl (e.g. a campaign created before this field
      // existed) - keep the old bare-image behavior rather than linking
      // nowhere useful.
      if (!campaign.destinationUrl) {
        return image;
      }

      return `<a href="${this.escapeHtmlAttribute(this.buildClickUrl(campaign, context))}" target="_blank" rel="noopener noreferrer">${image}</a>`;
    }

    return `<a href="/api/v1/trap" style="display:none !important;"></a>`;
  }

  // Routes the click through the existing /api/v1/click endpoint (records
  // the click event, then 302s to the real destination) instead of linking
  // straight to destinationUrl, so a click on an image creative is tracked
  // the same way clicks already are for everything else. Must be an
  // absolute URL back to THIS server, not a relative path - the anchor is
  // rendered into a zone embedded cross-origin on the publisher's page (see
  // publisher_tag.js), so a relative href would resolve against the
  // publisher's own origin instead.
  private buildClickUrl(
    campaign: {
      id: string;
      advertiserId: string;
      maxCpc: number;
      maxCpm?: number | null;
      maxCpa?: number | null;
      destinationUrl?: string | null;
    },
    context: { zoneId: string; origin: string; path: string },
  ): string {
    // A CPM campaign is already billed per-impression (see
    // CpmBillingService), and a CPA campaign is only billed on a verified
    // conversion postback (see ConversionTrackingService) - either way, a
    // click must NOT also charge maxCpc, or it'd be double-billed (CPM) or
    // billed for something that isn't the agreed pricing model at all
    // (CPA). cost=0 here means AdBillingService.billClick's own
    // `if (!(event.cost > 0)) return;` guard skips billing this click
    // entirely, same as it already does for a 0-cost/duplicate event.
    const cost =
      this.isCpmCampaign(campaign) || this.isCpaCampaign(campaign)
        ? 0
        : campaign.maxCpc;
    const clickUrl = new URL('/api/v1/click', adServerPublicOrigin());
    clickUrl.searchParams.set('zoneId', context.zoneId);
    clickUrl.searchParams.set('campaignId', campaign.id);
    clickUrl.searchParams.set('advertiserId', campaign.advertiserId);
    clickUrl.searchParams.set('cost', String(cost));
    clickUrl.searchParams.set('origin', context.origin);
    clickUrl.searchParams.set('path', context.path);
    clickUrl.searchParams.set('target', campaign.destinationUrl as string);

    // Only a CPA campaign gets a click_id at all - it's the sole thing
    // that ties a later conversion postback back to this specific click
    // (see ConversionTrackingService.recordClick, called from /click
    // below), and persisting an AdClick row for every click on every
    // campaign regardless of pricing model would be pure overhead for
    // campaigns that will never receive a postback.
    if (this.isCpaCampaign(campaign)) {
      clickUrl.searchParams.set('clickId', randomUUID());
    }

    return clickUrl.toString();
  }

  private escapeHtmlAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // maxCpm being set (and positive) is the actual "this campaign is
  // CPM-billed" signal - see the comment on Campaign.maxCpm in
  // schema.prisma for why this deliberately does NOT check pricingModel.
  private isCpmCampaign(campaign: { maxCpm?: number | null }): boolean {
    return campaign.maxCpm != null && campaign.maxCpm > 0;
  }

  // Same reasoning as isCpmCampaign - see Campaign.maxCpa in schema.prisma.
  private isCpaCampaign(campaign: { maxCpa?: number | null }): boolean {
    return campaign.maxCpa != null && campaign.maxCpa > 0;
  }

  // Stable per-visitor identity for AdTargetingService's frequency cap.
  // There's no cookie/session here (the tag is embedded cross-origin and
  // deliberately sends credentials: 'omit' - see publisher_tag.js), so
  // IP+UA is the same imperfect-but-workable proxy the rest of this module
  // already uses for fraud/velocity signals. Hashed (not the raw IP)
  // purely so the frequency-cap Redis keys don't carry it in the clear.
  private buildVisitorId(ipAddress: string, userAgent: string): string {
    const normalizedIp = (ipAddress ?? '')
      .replace('::ffff:', '')
      .split(',')[0]
      .trim();

    if (!normalizedIp) {
      return '';
    }

    return createHash('sha1')
      .update(`${normalizedIp}:${userAgent ?? ''}`)
      .digest('hex');
  }

  @Get('click')
  async click(
    @Query('zoneId') zoneId: string,
    @Query('campaignId') campaignId: string,
    @Query('advertiserId') advertiserId: string,
    @Query('cost') cost: string,
    @Query('origin') origin: string,
    @Query('path') path: string,
    @Query('target') target: string,
    @Query('clickId') clickId: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-geo-country') countryHeader: string,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const fraudDecision = await this.fraudDetectionService.evaluateClickRequest(
      ipAddress,
      userAgent,
    );

    if (fraudDecision.blocked) {
      throw new ForbiddenException(fraudDecision.reason);
    }

    const country = this.geoIpService.resolveCountry(ipAddress, countryHeader);
    const device = this.deviceDetectorService.detect(userAgent, 0);

    this.adEventProducerService.publishClick({
      type: 'click',
      zone: zoneId,
      campaign: campaignId,
      advertiser: advertiserId,
      cost: Number(cost) || 0,
      time: Math.floor(Date.now() / 1000),
      request: {
        origin,
        path,
        country,
        device,
        ipAddress,
        userAgent,
      },
    });

    // Only present for a CPA-priced campaign (see buildClickUrl) - persists
    // the AdClick row a later conversion postback will claim. Awaited (not
    // fire-and-forget) because a lost write here means a lost conversion
    // attribution later - same reasoning as the frequency-cap increment in
    // AdTargetingService. recordClick itself never throws, so this can't
    // break the redirect below.
    if (clickId) {
      await this.conversionTrackingService.recordClick(
        clickId,
        campaignId,
        zoneId,
      );
    }

    if (target) {
      response.redirect(
        HttpStatus.FOUND,
        clickId ? this.appendClickId(target, clickId) : target,
      );
      return;
    }

    return {
      recorded: true,
    };
  }

  // Forwards click_id onto the advertiser's own destination URL so their
  // landing page can capture it (e.g. into a hidden form field, or their
  // checkout session) and include it in the eventual conversion postback -
  // see GET /api/v1/conversion below. Falls back to the unmodified target
  // if it somehow isn't a valid absolute URL rather than breaking the
  // redirect entirely - the click is still tracked either way, this only
  // affects whether a LATER conversion can be attributed to it.
  private appendClickId(target: string, clickId: string): string {
    try {
      const url = new URL(target);
      url.searchParams.set('click_id', clickId);

      return url.toString();
    } catch {
      return target;
    }
  }

  // Advertiser's own server calls this once a click converts (a purchase,
  // a signup, ...) - see the click_id forwarded by appendClickId above.
  // Deliberately lenient/idempotent (see ConversionTrackingService) rather
  // than erroring on a duplicate postback, since postback senders commonly
  // retry regardless of the previous response.
  @Get('conversion')
  async conversion(
    @Query('clickId') clickId: string,
    @Query('value') value: string,
  ) {
    if (!clickId) {
      return { recorded: false, reason: 'MISSING_CLICK_ID' };
    }

    const conversionValue = value ? Number(value) : undefined;

    return this.conversionTrackingService.recordConversion(
      clickId,
      Number.isFinite(conversionValue) ? conversionValue : undefined,
    );
  }

  @Get('trap')
  async trap(
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    await this.fraudDetectionService.recordHoneypotHit(ipAddress, userAgent);

    return {
      blocked: true,
    };
  }
}
