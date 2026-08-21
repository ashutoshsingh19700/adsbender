import { Test, TestingModule } from '@nestjs/testing';

import { AdEventProducerService } from './ad-event-producer.service';
import { AdEngineController } from './ad-engine.controller';
import { AdTargetingService } from './ad-targeting.service';
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
          provide: FraudDetectionService,
          useValue: fraudDetectionService,
        },
        {
          provide: SiteAutoVerificationService,
          useValue: siteAutoVerificationService,
        },
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
      creative: {
        campaignId: 'campaign-high',
        advertiserId: 'advertiser-1',
        campaignName: 'US Mobile High Bid',
        bidUsd: 2.5,
        html: '<a href="/api/v1/trap" style="display:none !important;"></a>',
      },
    });
    expect(adTargetingService.selectCampaign).toHaveBeenCalledWith({
      zoneId: '42',
      country: 'US',
      device: 'mobile',
    });
    expect(adEventProducerService.publishImpression).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'impression',
        zone: '42',
        campaign: 'campaign-high',
        advertiser: 'advertiser-1',
        cost: 2.5,
        request: expect.objectContaining({
          country: 'US',
          device: 'mobile',
          origin: 'https://publisher.test',
          path: '/article',
        }),
      }),
    );
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
      'Mozilla/5.0 Mobile',
      'US',
      '127.0.0.1',
      response as any,
    );

    expect(fraudDetectionService.evaluateClickRequest).toHaveBeenCalledWith(
      '127.0.0.1',
      'Mozilla/5.0 Mobile',
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
        'Mozilla/5.0 Mobile',
        'US',
        '127.0.0.1',
        response as any,
      ),
    ).rejects.toThrow('CLICK_VELOCITY_EXCEEDED');
    expect(adEventProducerService.publishClick).not.toHaveBeenCalled();
    expect(response.redirect).not.toHaveBeenCalled();
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
});
