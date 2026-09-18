import { createHash, randomUUID } from 'crypto';

import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpStatus,
  Inject,
  Ip,
  Query,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AdEventProducerService } from './ad-event-producer.service';
import { AdTargetingService } from './ad-targeting.service';
import { ClickIntegrityService } from './click-integrity.service';
import { ConversionTrackingService } from './conversion-tracking.service';
import { DeviceDetectorService } from './device-detector.service';
import type { FraudDecision } from './fraud-detection.service';
import { FraudDetectionService } from './fraud-detection.service';
import { GeoIpService } from './geo-ip.service';
import { PublisherImpressionDedupService } from './publisher-impression-dedup.service';
import { SiteAutoVerificationService } from './site-auto-verification.service';
import { ZONE_CACHE_STORE } from './zone-cache-sync.service';
import type { ZoneCacheStore } from './zone-cache.types';
import { adServerPublicOrigin } from '../config/env';
import { renderFamilyForFormat } from '../common/ad-formats';

// Real ad traffic, not app users - already policed by
// FraudDetectionService/FrequencyCappingService's own velocity checks (see
// ThrottlerModule.forRoot's comment in app.module.ts for why a flat
// per-IP cap doesn't belong here too).
@SkipThrottle()
@Controller('api/v1')
export class AdEngineController {
  constructor(
    private readonly adTargetingService: AdTargetingService,
    private readonly adEventProducerService: AdEventProducerService,
    private readonly clickIntegrityService: ClickIntegrityService,
    private readonly conversionTrackingService: ConversionTrackingService,
    private readonly deviceDetectorService: DeviceDetectorService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly geoIpService: GeoIpService,
    private readonly publisherImpressionDedupService: PublisherImpressionDedupService,
    private readonly siteAutoVerificationService: SiteAutoVerificationService,
    @Inject(ZONE_CACHE_STORE)
    private readonly zoneCacheStore: ZoneCacheStore,
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
    const country = this.geoIpService.resolveCountry(ipAddress, countryHeader);
    const device = this.deviceDetectorService.detect(
      userAgent,
      Number(viewportWidth),
    );
    const fraudDecision = await this.fraudDetectionService.evaluateServeRequest(
      ipAddress,
      userAgent,
    );

    if (fraudDecision.blocked || fraudDecision.flagged) {
      this.publishTrafficEvent(
        fraudDecision,
        'impression',
        { origin, path, country, device, ipAddress, userAgent },
        { zoneId },
      );
    }

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
    const selectedCampaign = await this.adTargetingService.selectCampaign({
      zoneId,
      country,
      device,
      visitorId: this.buildVisitorId(ipAddress, userAgent),
    });

    if (selectedCampaign) {
      const isCpmCampaign = this.isCpmCampaign(selectedCampaign);

      // Re-reads the same Redis-cached zone record AdTargetingService just
      // used to select this campaign (a cheap single GET against an
      // already-warm JSON blob - see RedisZoneCacheStore) rather than
      // threading zone data through selectCampaign's return value, so the
      // targeting/auction logic stays untouched by this. Missing zone data
      // (shouldn't happen - selectedCampaign only exists because the zone
      // was just found active) fails open to "unique" rather than silently
      // dropping the publisher's impression count.
      const zone = await this.zoneCacheStore.getActiveZone(zoneId);
      const uniquePublisherImpression = zone
        ? await this.publisherImpressionDedupService.isUniqueImpression(
            zone,
            ipAddress,
          )
        : true;

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
        uniquePublisherImpression,
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
      // The format/family actually served - see RENDER_FAMILY_BY_FORMAT.
      // Null when nothing was served, or when the winning campaign predates
      // adFormat entirely (renderFamilyForFormat falls back to 'inline',
      // matching that campaign's only-ever behavior before this existed).
      format: selectedCampaign?.adFormat ?? null,
      renderFamily: renderFamilyForFormat(selectedCampaign?.adFormat),
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
      adFormat?: string | null;
    },
    context: { zoneId: string; origin: string; path: string },
  ): string {
    const renderFamily = renderFamilyForFormat(campaign.adFormat);

    if (renderFamily === 'video' || renderFamily === 'video_overlay') {
      if (campaign.creativeType === 'video' && campaign.creativeUrl) {
        return this.renderVideoCreative(campaign, context, renderFamily);
      }
      // A video-family zone with a non-video creative (misconfigured
      // campaign) falls through to the generic branches below rather than
      // rendering nothing.
    }

    if (campaign.creativeType === 'html' && campaign.creativeHtml) {
      return renderFamily === 'native'
        ? this.wrapNativeCreative(campaign.creativeHtml)
        : campaign.creativeHtml;
    }

    if (campaign.creativeType === 'image' && campaign.creativeUrl) {
      const image = `<img src="${this.escapeHtmlAttribute(campaign.creativeUrl)}" alt="" style="display:block;max-width:100%;height:auto;" />`;
      const inner = renderFamily === 'native' ? this.wrapNativeCreative(image) : image;

      // No destinationUrl (e.g. a campaign created before this field
      // existed) - keep the old bare-image behavior rather than linking
      // nowhere useful.
      if (!campaign.destinationUrl) {
        return inner;
      }

      return `<a href="${this.escapeHtmlAttribute(this.buildClickUrl(campaign, context))}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    }

    return `<a href="/api/v1/trap" style="display:none !important;"></a>`;
  }

  // Native formats (In-Article/In-Feed/Recommended Content/Sponsored
  // Widget) must visibly disclose that this is an ad rather than pretending
  // to be organic content - see publisher_tag.js's `native` family, which
  // adds its own "blend in" card styling around this markup. Kept simple
  // (a labeled wrapper around whatever creative markup the advertiser
  // supplied) rather than requiring separate structured headline/body/CTA
  // fields on Campaign.
  private wrapNativeCreative(inner: string): string {
    return `<div class="adnetwork-native" data-adnetwork-native="true"><span class="adnetwork-native__label" style="display:block;font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.6;margin-bottom:4px;">Sponsored</span>${inner}</div>`;
  }

  // Video formats get a real <video> element with native controls (not a
  // silent autoplay loop) plus a `data-skip-after` hint publisher_tag.js
  // uses to render a skip button once that many seconds have played -
  // PRE_ROLL/MID_ROLL/POST_ROLL only differ in where the publisher places
  // the zone relative to their own player, not in this markup. VIDEO_OVERLAY
  // gets `data-overlay="true"` so the tag positions it as a small bar
  // instead of a full-size player.
  private renderVideoCreative(
    campaign: {
      id: string;
      advertiserId: string;
      maxCpc: number;
      maxCpm?: number | null;
      maxCpa?: number | null;
      creativeUrl: string | null;
      destinationUrl?: string | null;
    },
    context: { zoneId: string; origin: string; path: string },
    renderFamily: 'video' | 'video_overlay',
  ): string {
    const isOverlay = renderFamily === 'video_overlay';
    const video =
      `<video src="${this.escapeHtmlAttribute(campaign.creativeUrl as string)}" ` +
      `controls playsinline muted ${isOverlay ? '' : 'autoplay '}` +
      `data-skip-after="5" ${isOverlay ? 'data-overlay="true" ' : ''}` +
      `style="display:block;max-width:100%;height:auto;"></video>`;

    if (!campaign.destinationUrl) {
      return video;
    }

    return `<a href="${this.escapeHtmlAttribute(this.buildClickUrl(campaign, context))}" target="_blank" rel="noopener noreferrer" data-adnetwork-video-click="true">${video}</a>`;
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
    // Proves at /click time that this exact click followed a real /serve
    // response for this exact zone+campaign - see ClickIntegrityService and
    // FraudDetectionService.evaluateClickRequest. `t` (not `token`) to keep
    // the click URL compact - it's rendered into the page as a literal
    // anchor href on every impression.
    clickUrl.searchParams.set(
      't',
      this.clickIntegrityService.sign(context.zoneId, campaign.id),
    );

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

  // Records every non-billable fraud/traffic-quality decision - blocked or
  // merely flagged - so it shows up in the traffic_events ClickHouse table
  // and the fraud analytics dashboards (see AnalyticsService.getTrafficQuality
  // and PublisherService/AdvertiserService/AdminService's own scoped
  // wrappers around it). A blocked request never becomes an
  // ImpressionEvent/ClickEvent, so without this call it would leave no
  // trace anywhere - see TrafficEvent's doc comment in ad-event.types.ts.
  private publishTrafficEvent(
    decision: FraudDecision,
    stage: 'impression' | 'click',
    request: {
      origin: string;
      path: string;
      country: string | null;
      device: string;
      ipAddress: string;
      userAgent: string;
    },
    context?: { zoneId: string; campaignId?: string; advertiserId?: string },
  ) {
    this.adEventProducerService.publishTraffic({
      type: 'traffic',
      stage,
      outcome: decision.blocked ? 'blocked' : 'flagged',
      reason: decision.reason ?? 'UNKNOWN',
      zone: context?.zoneId ?? '',
      campaign: context?.campaignId,
      advertiser: context?.advertiserId,
      time: Math.floor(Date.now() / 1000),
      request,
    });
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
    @Query('t') clickToken: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-geo-country') countryHeader: string,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const numericCost = Number(cost) || 0;
    const country = this.geoIpService.resolveCountry(ipAddress, countryHeader);
    const device = this.deviceDetectorService.detect(userAgent, 0);
    const requestContext = { origin, path, country, device, ipAddress, userAgent };

    const fraudDecision = await this.fraudDetectionService.evaluateClickRequest(
      ipAddress,
      userAgent,
      { zoneId, campaignId, clickToken, billable: numericCost > 0 },
    );

    if (fraudDecision.blocked || fraudDecision.flagged) {
      this.publishTrafficEvent(fraudDecision, 'click', requestContext, {
        zoneId,
        campaignId,
        advertiserId,
      });
    }

    if (fraudDecision.blocked) {
      throw new ForbiddenException(fraudDecision.reason);
    }

    this.adEventProducerService.publishClick({
      type: 'click',
      zone: zoneId,
      campaign: campaignId,
      advertiser: advertiserId,
      cost: numericCost,
      time: Math.floor(Date.now() / 1000),
      request: requestContext,
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

  // A 1x1 open-tracking pixel for delivery channels that can't run
  // publisher_tag.js at all (currently just Newsletter Sponsorship - email
  // clients strip <script> tags). Unlike /serve, this never picks a
  // campaign itself - PublisherService.getNewsletterSnippet already chose
  // one when the snippet was generated, so this only records the
  // impression that campaign/zone pairing actually got. `cost` is
  // precomputed by the snippet the same way buildClickUrl precomputes a
  // click's cost, for the same reason (a CPM campaign is billed here per
  // impression; a CPC/CPA campaign must never also be charged an
  // impression cost).
  private static readonly TRANSPARENT_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
    'base64',
  );

  @Get('pixel')
  async pixel(
    @Query('zoneId') zoneId: string,
    @Query('campaignId') campaignId: string,
    @Query('advertiserId') advertiserId: string,
    @Query('cost') cost: string,
    @Query('maxCpm') maxCpm: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-geo-country') countryHeader: string,
    @Ip() ipAddress: string,
    @Res({ passthrough: false }) response: Response,
  ) {
    const country = this.geoIpService.resolveCountry(ipAddress, countryHeader);

    if (zoneId && campaignId && advertiserId) {
      const numericMaxCpm = Number(maxCpm);

      this.adEventProducerService.publishImpression({
        type: 'impression',
        zone: zoneId,
        campaign: campaignId,
        advertiser: advertiserId,
        cost: Number(cost) || 0,
        time: Math.floor(Date.now() / 1000),
        maxCpm:
          Number.isFinite(numericMaxCpm) && numericMaxCpm > 0
            ? numericMaxCpm
            : undefined,
        // Newsletter opens aren't "roaming multiple pages of a website" -
        // there's no site/page to dedup across here, just one open per send
        // - so every open counts as its own impression for the publisher
        // too, same as it always has.
        uniquePublisherImpression: true,
        request: {
          origin: '',
          path: '',
          country,
          device: 'unknown',
          ipAddress,
          userAgent,
        },
      });
    }

    response.set('Content-Type', 'image/gif');
    response.set('Cache-Control', 'no-store');
    response.send(AdEngineController.TRANSPARENT_GIF);
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
