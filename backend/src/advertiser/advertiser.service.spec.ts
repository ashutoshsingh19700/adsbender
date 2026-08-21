import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampaignStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { AdvertiserService } from './advertiser.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { WalletManager } from '../wallet/wallet-manager.service';

describe('AdvertiserService', () => {
  let service: AdvertiserService;
  const prismaService = {
    campaign: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  };
  const analyticsService = {
    getDailyMetrics: jest.fn(),
  };
  const walletManager = {
    releaseCampaignReservation: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvertiserService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: WalletManager, useValue: walletManager },
      ],
    }).compile();

    service = module.get(AdvertiserService);
  });

  it('creates advertiser campaigns in pending review state with targets and creative data', async () => {
    prismaService.campaign.create.mockResolvedValue({
      id: 'campaign-1',
      campaignName: 'US Mobile Launch',
      status: CampaignStatus.PENDING_REVIEW,
    });

    await expect(
      service.createCampaign('advertiser-1', {
        campaignName: 'US Mobile Launch',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 0.5,
        targetCountries: ['us', ' in '],
        targetDevices: ['mobile'],
        creativeType: 'image',
        creativeUrl: 'https://cdn.example.com/ad.png',
        destinationUrl: 'https://advertiser.example/landing',
      }),
    ).resolves.toEqual({
      message: 'Campaign submitted for review',
      campaign: {
        id: 'campaign-1',
        campaignName: 'US Mobile Launch',
        status: CampaignStatus.PENDING_REVIEW,
      },
    });
    expect(prismaService.campaign.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        advertiserId: 'advertiser-1',
        targetCountries: ['US', 'IN'],
        targetDevices: ['mobile'],
        destinationUrl: 'https://advertiser.example/landing',
        status: CampaignStatus.PENDING_REVIEW,
      }),
    });
  });

  it('rejects an image campaign with no destination URL', async () => {
    await expect(
      service.createCampaign('advertiser-1', {
        campaignName: 'Missing Destination',
        totalBudget: 100,
        dailyBudget: 10,
        maxCpc: 0.5,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        creativeType: 'image',
        creativeUrl: 'https://cdn.example.com/ad.png',
      } as never),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.campaign.create).not.toHaveBeenCalled();
  });

  it('rejects a daily budget above the total budget', async () => {
    await expect(
      service.createCampaign('advertiser-1', {
        campaignName: 'Bad Budget',
        totalBudget: 10,
        dailyBudget: 20,
        maxCpc: 0.5,
        targetCountries: ['US'],
        targetDevices: ['mobile'],
        creativeType: 'image',
        creativeUrl: 'https://cdn.example.com/ad.png',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.campaign.create).not.toHaveBeenCalled();
  });

  it("blocks an advertiser from reading another advertiser's campaign", async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'someone-else',
      status: CampaignStatus.ACTIVE,
    });

    await expect(
      service.getCampaign('advertiser-1', 'campaign-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects editing a campaign that is currently ACTIVE', async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'advertiser-1',
      status: CampaignStatus.ACTIVE,
      totalBudget: 100,
      dailyBudget: 10,
    });

    await expect(
      service.updateCampaign('advertiser-1', 'campaign-1', {
        campaignName: 'New name',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.campaign.update).not.toHaveBeenCalled();
  });

  it('allows pausing an active campaign', async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'advertiser-1',
      status: CampaignStatus.ACTIVE,
    });
    prismaService.campaign.update.mockResolvedValue({
      id: 'campaign-1',
      status: CampaignStatus.PAUSED,
    });

    await expect(
      service.pauseCampaign('advertiser-1', 'campaign-1'),
    ).resolves.toEqual({ id: 'campaign-1', status: CampaignStatus.PAUSED });
  });

  it('releases the reserved budget back to the advertiser when archiving a paused campaign', async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'advertiser-1',
      campaignName: 'US Mobile Launch',
      status: CampaignStatus.PAUSED,
      reservedAmount: 40,
    });
    prismaService.campaign.update.mockResolvedValue({
      id: 'campaign-1',
      status: CampaignStatus.ARCHIVED,
    });

    await expect(
      service.archiveCampaign('advertiser-1', 'campaign-1'),
    ).resolves.toEqual({ id: 'campaign-1', status: CampaignStatus.ARCHIVED });

    expect(walletManager.releaseCampaignReservation).toHaveBeenCalledWith(
      'advertiser-1',
      'campaign-1',
      40,
      expect.stringContaining('US Mobile Launch'),
    );
  });

  it('does not touch the wallet when archiving a campaign with nothing reserved', async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'advertiser-1',
      campaignName: 'Draft campaign',
      status: CampaignStatus.DRAFT,
      reservedAmount: 0,
    });
    prismaService.campaign.update.mockResolvedValue({
      id: 'campaign-1',
      status: CampaignStatus.ARCHIVED,
    });

    await expect(
      service.archiveCampaign('advertiser-1', 'campaign-1'),
    ).resolves.toEqual({ id: 'campaign-1', status: CampaignStatus.ARCHIVED });

    expect(walletManager.releaseCampaignReservation).not.toHaveBeenCalled();
  });

  it('rejects resuming a campaign that was never active (still pending review)', async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'advertiser-1',
      status: CampaignStatus.PENDING_REVIEW,
    });

    await expect(
      service.resumeCampaign('advertiser-1', 'campaign-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.campaign.update).not.toHaveBeenCalled();
  });

  it('deletes only DRAFT campaigns', async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'advertiser-1',
      status: CampaignStatus.PAUSED,
    });

    await expect(
      service.deleteCampaign('advertiser-1', 'campaign-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.campaign.delete).not.toHaveBeenCalled();
  });

  it('scopes campaign performance lookups to the owning advertiser and campaign', async () => {
    prismaService.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      advertiserId: 'advertiser-1',
      status: CampaignStatus.ACTIVE,
    });
    analyticsService.getDailyMetrics.mockResolvedValue({
      rows: [],
      totals: { impressions: 0, clicks: 0, ctr: 0, spend: 0, payout: 0 },
    });

    await service.getCampaignPerformance(
      'advertiser-1',
      'campaign-1',
      '2026-08-01',
      '2026-08-13',
    );

    expect(analyticsService.getDailyMetrics).toHaveBeenCalledWith(
      '2026-08-01',
      '2026-08-13',
      { campaignId: 'campaign-1' },
    );
  });
});
