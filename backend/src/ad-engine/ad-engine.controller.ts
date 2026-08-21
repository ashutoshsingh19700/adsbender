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
    });

    if (selectedCampaign) {
      this.adEventProducerService.publishImpression({
        type: 'impression',
        zone: zoneId,
        campaign: selectedCampaign.id,
        advertiser: selectedCampaign.advertiserId,
        cost: selectedCampaign.maxCpc,
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
    campaign: { id: string; advertiserId: string; maxCpc: number; destinationUrl?: string | null },
    context: { zoneId: string; origin: string; path: string },
  ): string {
    const clickUrl = new URL('/api/v1/click', adServerPublicOrigin());
    clickUrl.searchParams.set('zoneId', context.zoneId);
    clickUrl.searchParams.set('campaignId', campaign.id);
    clickUrl.searchParams.set('advertiserId', campaign.advertiserId);
    clickUrl.searchParams.set('cost', String(campaign.maxCpc));
    clickUrl.searchParams.set('origin', context.origin);
    clickUrl.searchParams.set('path', context.path);
    clickUrl.searchParams.set('target', campaign.destinationUrl as string);

    return clickUrl.toString();
  }

  private escapeHtmlAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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

    if (target) {
      response.redirect(HttpStatus.FOUND, target);
      return;
    }

    return {
      recorded: true,
    };
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
