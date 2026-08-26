import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AdBillingService } from './ad-billing.service';
import { ConversionTrackingService } from './conversion-tracking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConversionTrackingService', () => {
  let service: ConversionTrackingService;
  let prisma: {
    adClick: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
    campaign: { findUnique: jest.Mock };
    adZone: { findUnique: jest.Mock };
  };
  let adBillingService: { billConversion: jest.Mock };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    prisma = {
      adClick: {
        create: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      campaign: { findUnique: jest.fn() },
      adZone: { findUnique: jest.fn() },
    };
    adBillingService = { billConversion: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversionTrackingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdBillingService, useValue: adBillingService },
      ],
    }).compile();

    service = module.get(ConversionTrackingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordClick', () => {
    it('creates an AdClick row keyed by the given clickId', async () => {
      await service.recordClick('click-1', 'campaign-1', 'zone-1');

      expect(prisma.adClick.create).toHaveBeenCalledWith({
        data: { id: 'click-1', campaignId: 'campaign-1', zoneId: 'zone-1' },
      });
    });

    it('swallows a write failure without throwing (must never break the click redirect)', async () => {
      prisma.adClick.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.recordClick('click-1', 'campaign-1', 'zone-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordConversion', () => {
    it('claims the click, bills the conversion, and reports it recorded', async () => {
      prisma.adClick.updateMany.mockResolvedValue({ count: 1 });
      prisma.adClick.findUnique.mockResolvedValue({
        campaignId: 'campaign-1',
        zoneId: 'zone-1',
      });
      prisma.campaign.findUnique.mockResolvedValue({ maxCpa: '20.00' });
      prisma.adZone.findUnique.mockResolvedValue({ publisherId: 'publisher-1' });

      await expect(
        service.recordConversion('click-1', 49.99),
      ).resolves.toEqual({ recorded: true });

      expect(prisma.adClick.updateMany).toHaveBeenCalledWith({
        where: { id: 'click-1', convertedAt: null },
        data: { convertedAt: expect.any(Date), conversionValue: 49.99 },
      });
      expect(adBillingService.billConversion).toHaveBeenCalledWith(
        'campaign-1',
        'publisher-1',
        20,
        'conversion:click-1',
      );
    });

    it('reports ALREADY_CONVERTED for a duplicate postback without billing again', async () => {
      prisma.adClick.updateMany.mockResolvedValue({ count: 0 });
      prisma.adClick.findUnique.mockResolvedValue({
        campaignId: 'campaign-1',
        zoneId: 'zone-1',
        convertedAt: new Date(),
      });

      await expect(service.recordConversion('click-1')).resolves.toEqual({
        recorded: false,
        reason: 'ALREADY_CONVERTED',
      });
      expect(adBillingService.billConversion).not.toHaveBeenCalled();
    });

    it('reports CLICK_NOT_FOUND for an unknown clickId', async () => {
      prisma.adClick.updateMany.mockResolvedValue({ count: 0 });
      prisma.adClick.findUnique.mockResolvedValue(null);

      await expect(service.recordConversion('bogus-click')).resolves.toEqual({
        recorded: false,
        reason: 'CLICK_NOT_FOUND',
      });
      expect(adBillingService.billConversion).not.toHaveBeenCalled();
    });

    it('records the conversion but skips billing when the campaign has no maxCpa', async () => {
      prisma.adClick.updateMany.mockResolvedValue({ count: 1 });
      prisma.adClick.findUnique.mockResolvedValue({
        campaignId: 'campaign-1',
        zoneId: 'zone-1',
      });
      prisma.campaign.findUnique.mockResolvedValue({ maxCpa: null });
      prisma.adZone.findUnique.mockResolvedValue({ publisherId: 'publisher-1' });

      await expect(service.recordConversion('click-1')).resolves.toEqual({
        recorded: true,
      });
      expect(adBillingService.billConversion).not.toHaveBeenCalled();
    });

    it('records the conversion but skips billing when the zone no longer exists', async () => {
      prisma.adClick.updateMany.mockResolvedValue({ count: 1 });
      prisma.adClick.findUnique.mockResolvedValue({
        campaignId: 'campaign-1',
        zoneId: 'zone-1',
      });
      prisma.campaign.findUnique.mockResolvedValue({ maxCpa: '20.00' });
      prisma.adZone.findUnique.mockResolvedValue(null);

      await expect(service.recordConversion('click-1')).resolves.toEqual({
        recorded: true,
      });
      expect(adBillingService.billConversion).not.toHaveBeenCalled();
    });
  });
});
