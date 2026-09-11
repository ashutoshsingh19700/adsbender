import { Test, TestingModule } from '@nestjs/testing';

import { AdEventProducerService } from './ad-event-producer.service';
import { AdEngineController } from './ad-engine.controller';
import { AdTargetingService } from './ad-targeting.service';
import { ClickIntegrityService } from './click-integrity.service';
import { ConversionTrackingService } from './conversion-tracking.service';
import { DeviceDetectorService } from './device-detector.service';
import { FraudDetectionService } from './fraud-detection.service';
import { GeoIpService } from './geo-ip.service';
import { SiteAutoVerificationService } from './site-auto-verification.service';

describe('AdEngineController', () => {
  let controller: AdEngineController;
  const adTargetingService = {
    selectCampaign: jest.fn(),
  };
  const adEventProducerService = {
    publishImpression: jest.fn(),
    publishClick: jest.fn(),
    publishTraffic: jest.fn(),
  };
  const conversionTrackingService = {
    recordClick: jest.fn(),
    recordConversion: jest.fn(),
  };
  const fraudDetectionService = {
    evaluateServeRequest: jest.fn(),
    evaluateClickRequest: jest.fn(),
    recordHoneypotHit: jest.fn(),
  };
  const siteAutoVerificationService = {
    verifyFromRequestHeader: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fraudDetectionService.evaluateServeRequest.mockResolvedValue({
      blocked: false,
    });
    fraudDetectionService.evaluateClickRequest.mockResolvedValue({
      blocked: false,
    });
    conversionTrackingService.recordClick.mockResolvedValue(undefined);
    conversionTrackingService.recordConversion.mockResolvedValue({
      recorded: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdEngineController],
      providers: [
        {
          provide: AdTargetingService,
          useValue: adTargetingService,
        },
        {
          provide: AdEventProducerService,
          useValue: adEventProducerService,
        },
        {
          provide: ConversionTrackingService,
          useValue: conversionTrackingService,
        },
        {
          provide: FraudDetectionService,
          useValue: fraudDetectionService,
        },
        {
          provide: SiteAutoVerificationService,
          useValue: siteAutoVerificationService,
        },
        ClickIntegrityService,
        DeviceDetectorService,
        GeoIpService,
      ],
    }).compile();

    controller = module.get(AdEngineController);
  });

  it('returns the highest-bid Redis-selected campaign for a simulated US mobile request', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-high',
      advertiserId: 'advertiser-1',
      campaignName: 'US Mobile High Bid',
      maxCpc: 2.5,
      creativeType: 'html',
      creativeUrl: null,
      creativeHtml: '<div>US Mobile High Bid creative</div>',
    });

    await expect(
      controller.serve(
        '42',
        'https://publisher.test',
        '/article',
        '1366',
        '768',
        '1',
        'https://referrer.test',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
        'US',
        'https://publisher.test/article',
        'https://publisher.test',
        '127.0.0.1',
      ),
    ).resolves.toEqual({
      type: 'ad_response',
      zoneId: '42',
      request: {
        origin: 'https://publisher.test',
        path: '/article',
        viewportWidth: 1366,
        viewportHeight: 768,
        devicePixelRatio: 1,
        referrer: 'https://referrer.test',
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
        ipAddress: '127.0.0.1',
        country: 'US',
        device: 'mobile',
      },
      format: null,
      renderFamily: 'inline',
      creative: {
        campaignId: 'campaign-high',
        advertiserId: 'advertiser-1',
        campaignName: 'US Mobile High Bid',
        bidUsd: 2.5,
        html: '<div>US Mobile High Bid creative</div>',
      },
    });
    expect(adTargetingService.selectCampaign).toHaveBeenCalledWith({
      zoneId: '42',
      country: 'US',
      device: 'mobile',
      // Derived (hashed IP+UA) rather than a literal to assert against -
      // its exact shape is an implementation detail of the controller, not
      // something callers of selectCampaign should depend on.
      visitorId: expect.any(String),
    });
    // A CPC campaign (no maxCpm) is billed on click, not impression - the
    // impression event's cost stays 0 so it isn't double-counted as spend.
    expect(adEventProducerService.publishImpression).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'impression',
        zone: '42',
        campaign: 'campaign-high',
        advertiser: 'advertiser-1',
        cost: 0,
        maxCpm: undefined,
        request: expect.objectContaining({
          country: 'US',
          device: 'mobile',
          origin: 'https://publisher.test',
          path: '/article',
        }),
      }),
    );
  });

  it('publishes a CPM-priced impression with the per-impression estimate and maxCpm for batch billing', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-cpm',
      advertiserId: 'advertiser-4',
      campaignName: 'CPM Campaign',
      maxCpc: 0.5,
      maxCpm: 3,
      creativeType: 'html',
      creativeUrl: null,
      creativeHtml: '<div>CPM creative</div>',
    });

    await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(adEventProducerService.publishImpression).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign: 'campaign-cpm',
        cost: 0.003, // $3 CPM / 1000
        maxCpm: 3,
      }),
    );
  });

  it('renders an image creative as an <img> tag', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-image',
      advertiserId: 'advertiser-2',
      campaignName: 'Image Campaign',
      maxCpc: 1,
      creativeType: 'image',
      creativeUrl: 'https://cdn.example.com/creative.png?v=1&who="attacker"',
      creativeHtml: null,
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.creative?.html).toBe(
      '<img src="https://cdn.example.com/creative.png?v=1&amp;who=&quot;attacker&quot;" alt="" style="display:block;max-width:100%;height:auto;" />',
    );
  });

  it('wraps an image creative in a click-tracked link when destinationUrl is set', async () => {
    // Pinned explicitly rather than relying on the ambient environment -
    // adServerPublicOrigin() derives from PUBLIC_TAG_URL, which other
    // suites sharing this process may have already populated from .env.
    const previousTagUrl = process.env.PUBLIC_TAG_URL;
    process.env.PUBLIC_TAG_URL = 'http://localhost:3000/assets/publisher_tag.js';

    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-image-2',
      advertiserId: 'advertiser-2',
      campaignName: 'Image Campaign With Destination',
      maxCpc: 1.25,
      creativeType: 'image',
      creativeUrl: 'https://cdn.example.com/creative.png',
      creativeHtml: null,
      destinationUrl: 'https://advertiser.example/landing?ref=ad',
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    // The click URL also carries a `t` (click-integrity token) param signed
    // per-response - see ClickIntegrityService - so this asserts the
    // structure/params rather than the whole string verbatim.
    expect(response.creative?.html).toMatch(
      /^<a href="http:\/\/localhost:3000\/api\/v1\/click\?zoneId=42&amp;campaignId=campaign-image-2&amp;advertiserId=advertiser-2&amp;cost=1\.25&amp;origin=https%3A%2F%2Fpublisher\.test&amp;path=%2Farticle&amp;target=https%3A%2F%2Fadvertiser\.example%2Flanding%3Fref%3Dad&amp;t=[\w-]+\.[\w-]+" target="_blank" rel="noopener noreferrer"><img src="https:\/\/cdn\.example\.com\/creative\.png" alt="" style="display:block;max-width:100%;height:auto;" \/><\/a>$/,
    );

    if (previousTagUrl === undefined) {
      delete process.env.PUBLIC_TAG_URL;
    } else {
      process.env.PUBLIC_TAG_URL = previousTagUrl;
    }
  });

  it('zeroes the click cost for a CPM-priced image campaign, so a click is never also billed', async () => {
    const previousTagUrl = process.env.PUBLIC_TAG_URL;
    process.env.PUBLIC_TAG_URL = 'http://localhost:3000/assets/publisher_tag.js';

    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-cpm-image',
      advertiserId: 'advertiser-5',
      campaignName: 'CPM Image Campaign',
      maxCpc: 1.25,
      maxCpm: 4,
      creativeType: 'image',
      creativeUrl: 'https://cdn.example.com/creative.png',
      creativeHtml: null,
      destinationUrl: 'https://advertiser.example/landing',
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.creative?.html).toContain('cost=0&amp;');

    if (previousTagUrl === undefined) {
      delete process.env.PUBLIC_TAG_URL;
    } else {
      process.env.PUBLIC_TAG_URL = previousTagUrl;
    }
  });

  it('zeroes the click cost and embeds a clickId for a CPA-priced image campaign', async () => {
    const previousTagUrl = process.env.PUBLIC_TAG_URL;
    process.env.PUBLIC_TAG_URL = 'http://localhost:3000/assets/publisher_tag.js';

    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-cpa-image',
      advertiserId: 'advertiser-6',
      campaignName: 'CPA Image Campaign',
      maxCpc: 1.25,
      maxCpa: 20,
      creativeType: 'image',
      creativeUrl: 'https://cdn.example.com/creative.png',
      creativeHtml: null,
      destinationUrl: 'https://advertiser.example/landing',
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.creative?.html).toContain('cost=0&amp;');
    // A fresh UUID per response - just confirm a clickId param made it in,
    // not its exact value.
    expect(response.creative?.html).toMatch(/clickId=[0-9a-f-]{36}/);

    if (previousTagUrl === undefined) {
      delete process.env.PUBLIC_TAG_URL;
    } else {
      process.env.PUBLIC_TAG_URL = previousTagUrl;
    }
  });

  it('falls back to the fraud honeypot link when a campaign has no usable creative content', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-empty',
      advertiserId: 'advertiser-3',
      campaignName: 'No Creative Yet',
      maxCpc: 1,
      creativeType: 'html',
      creativeUrl: null,
      creativeHtml: null,
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.creative?.html).toBe(
      '<a href="/api/v1/trap" style="display:none !important;"></a>',
    );
  });

  it('reports the winning campaign\'s format and render family on the response', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-popup',
      advertiserId: 'advertiser-5',
      campaignName: 'Popup Campaign',
      maxCpc: 1,
      creativeType: 'html',
      creativeUrl: null,
      creativeHtml: '<div>popup</div>',
      adFormat: 'POPUP',
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.format).toBe('POPUP');
    expect(response.renderFamily).toBe('popup');
  });

  it('wraps a native-format HTML creative with a visible "Sponsored" disclosure label', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-native',
      advertiserId: 'advertiser-6',
      campaignName: 'Native Campaign',
      maxCpc: 1,
      creativeType: 'html',
      creativeUrl: null,
      creativeHtml: '<div>native creative</div>',
      adFormat: 'IN_FEED',
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.renderFamily).toBe('native');
    expect(response.creative?.html).toContain('Sponsored');
    expect(response.creative?.html).toContain('<div>native creative</div>');
  });

  it('renders a video-format creative with controls and a skip-after hint instead of a silent autoplay loop', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-preroll',
      advertiserId: 'advertiser-7',
      campaignName: 'Pre-roll Campaign',
      maxCpc: 1,
      creativeType: 'video',
      creativeUrl: 'https://cdn.example.com/ad.mp4',
      creativeHtml: null,
      adFormat: 'PRE_ROLL',
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.renderFamily).toBe('video');
    expect(response.creative?.html).toContain('controls');
    expect(response.creative?.html).toContain('data-skip-after="5"');
    expect(response.creative?.html).not.toContain('data-overlay');
  });

  it('positions a VIDEO_OVERLAY creative as a small bar instead of a full autoplay player', async () => {
    adTargetingService.selectCampaign.mockResolvedValue({
      id: 'campaign-overlay',
      advertiserId: 'advertiser-8',
      campaignName: 'Video Overlay Campaign',
      maxCpc: 1,
      creativeType: 'video',
      creativeUrl: 'https://cdn.example.com/overlay.mp4',
      creativeHtml: null,
      adFormat: 'VIDEO_OVERLAY',
    });

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'US',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.renderFamily).toBe('video_overlay');
    expect(response.creative?.html).toContain('data-overlay="true"');
    expect(response.creative?.html).not.toContain('autoplay');
  });

  it('returns an empty creative when Redis targeting finds no match', async () => {
    adTargetingService.selectCampaign.mockResolvedValue(null);

    const response = await controller.serve(
      '42',
      'https://publisher.test',
      '/article',
      '1366',
      '768',
      '1',
      '',
      'Mozilla/5.0',
      'IN',
      'https://publisher.test/article',
      'https://publisher.test',
      '127.0.0.1',
    );

    expect(response.creative).toBeNull();
    expect(adEventProducerService.publishImpression).not.toHaveBeenCalled();
  });

  it('rejects blocked fraud traffic before targeting is evaluated', async () => {
    fraudDetectionService.evaluateServeRequest.mockResolvedValue({
      blocked: true,
      reason: 'SUSPICIOUS_USER_AGENT',
    });

    await expect(
      controller.serve(
        '42',
        'https://publisher.test',
        '/article',
        '1366',
        '768',
        '1',
        '',
        'curl/8.0',
        'US',
        'https://publisher.test/article',
        'https://publisher.test',
        '127.0.0.1',
      ),
    ).rejects.toThrow('SUSPICIOUS_USER_AGENT');
    expect(adTargetingService.selectCampaign).not.toHaveBeenCalled();
  });

  it('publishes a click event and redirects to the target landing page', async () => {
    const response = { redirect: jest.fn() };

    await controller.click(
      '42',
      'campaign-high',
      'advertiser-1',
      '2.5',
      'https://publisher.test',
      '/article',
      'https://advertiser.example/landing',
      '',
      'valid-token',
      'Mozilla/5.0 Mobile',
      'US',
      '127.0.0.1',
      response as any,
    );

    expect(fraudDetectionService.evaluateClickRequest).toHaveBeenCalledWith(
      '127.0.0.1',
      'Mozilla/5.0 Mobile',
      {
        zoneId: '42',
        campaignId: 'campaign-high',
        clickToken: 'valid-token',
        billable: true,
      },
    );
    expect(adEventProducerService.publishClick).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'click',
        zone: '42',
        campaign: 'campaign-high',
        advertiser: 'advertiser-1',
        cost: 2.5,
        request: expect.objectContaining({
          country: 'US',
          origin: 'https://publisher.test',
          path: '/article',
          ipAddress: '127.0.0.1',
        }),
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'https://advertiser.example/landing',
    );
    expect(conversionTrackingService.recordClick).not.toHaveBeenCalled();
  });

  it('records a click without redirecting when no target URL is provided', async () => {
    const response = { redirect: jest.fn() };

    await expect(
      controller.click(
        '42',
        'campaign-high',
        'advertiser-1',
        '2.5',
        'https://publisher.test',
        '/article',
        '',
        '',
        '',
        'Mozilla/5.0 Mobile',
        'US',
        '127.0.0.1',
        response as any,
      ),
    ).resolves.toEqual({ recorded: true });
    expect(response.redirect).not.toHaveBeenCalled();
  });

  it('rejects blocked fraud/velocity click traffic before publishing', async () => {
    fraudDetectionService.evaluateClickRequest.mockResolvedValue({
      blocked: true,
      reason: 'CLICK_VELOCITY_EXCEEDED',
    });
    const response = { redirect: jest.fn() };

    await expect(
      controller.click(
        '42',
        'campaign-high',
        'advertiser-1',
        '2.5',
        'https://publisher.test',
        '/article',
        'https://advertiser.example/landing',
        '',
        '',
        'Mozilla/5.0 Mobile',
        'US',
        '127.0.0.1',
        response as any,
      ),
    ).rejects.toThrow('CLICK_VELOCITY_EXCEEDED');
    expect(adEventProducerService.publishClick).not.toHaveBeenCalled();
    expect(response.redirect).not.toHaveBeenCalled();
  });

  it('records the click for later conversion attribution and forwards click_id to the destination URL', async () => {
    const response = { redirect: jest.fn() };

    await controller.click(
      '42',
      'campaign-cpa',
      'advertiser-1',
      '0',
      'https://publisher.test',
      '/article',
      'https://advertiser.example/landing?ref=ad',
      'click-abc-123',
      '',
      'Mozilla/5.0 Mobile',
      'US',
      '127.0.0.1',
      response as any,
    );

    expect(conversionTrackingService.recordClick).toHaveBeenCalledWith(
      'click-abc-123',
      'campaign-cpa',
      '42',
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'https://advertiser.example/landing?ref=ad&click_id=click-abc-123',
    );
  });

  it('still redirects using the unmodified target if it is not a valid absolute URL', async () => {
    const response = { redirect: jest.fn() };

    await controller.click(
      '42',
      'campaign-cpa',
      'advertiser-1',
      '0',
      'https://publisher.test',
      '/article',
      'not-a-valid-url',
      'click-abc-123',
      '',
      'Mozilla/5.0 Mobile',
      'US',
      '127.0.0.1',
      response as any,
    );

    expect(response.redirect).toHaveBeenCalledWith(302, 'not-a-valid-url');
  });

  it('records honeypot trap hits into the persistent blacklist', async () => {
    fraudDetectionService.recordHoneypotHit.mockResolvedValue({
      ipAddress: '127.0.0.1',
    });

    await expect(controller.trap('BadBot/1.0', '127.0.0.1')).resolves.toEqual({
      blocked: true,
    });
    expect(fraudDetectionService.recordHoneypotHit).toHaveBeenCalledWith(
      '127.0.0.1',
      'BadBot/1.0',
    );
  });

  describe('conversion', () => {
    it('forwards a valid conversion postback to ConversionTrackingService', async () => {
      conversionTrackingService.recordConversion.mockResolvedValue({
        recorded: true,
      });

      await expect(
        controller.conversion('click-abc-123', '49.99'),
      ).resolves.toEqual({ recorded: true });
      expect(conversionTrackingService.recordConversion).toHaveBeenCalledWith(
        'click-abc-123',
        49.99,
      );
    });

    it('passes no conversion value through when none is given', async () => {
      await controller.conversion('click-abc-123', '');

      expect(conversionTrackingService.recordConversion).toHaveBeenCalledWith(
        'click-abc-123',
        undefined,
      );
    });

    it('ignores a non-numeric conversion value rather than passing NaN through', async () => {
      await controller.conversion('click-abc-123', 'not-a-number');

      expect(conversionTrackingService.recordConversion).toHaveBeenCalledWith(
        'click-abc-123',
        undefined,
      );
    });

    it('short-circuits with MISSING_CLICK_ID when no clickId is given, without calling the service', async () => {
      await expect(controller.conversion('', '49.99')).resolves.toEqual({
        recorded: false,
        reason: 'MISSING_CLICK_ID',
      });
      expect(conversionTrackingService.recordConversion).not.toHaveBeenCalled();
    });
  });
});
