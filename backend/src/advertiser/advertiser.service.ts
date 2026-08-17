import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, Prisma } from '@prisma/client';

import { CAMPAIGN_TRANSITIONS } from './campaign-status.util';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { WalletManager } from '../wallet/wallet-manager.service';
import { assertTransition } from '../common/status-transition.util';
import { parsePagination } from '../common/pagination.util';

// Campaigns can only be edited while they're not live yet (DRAFT) or while
// they're paused - never mid-flight (ACTIVE/PENDING_REVIEW) or after they've
// finished (COMPLETED/ARCHIVED).
const EDITABLE_STATUSES: CampaignStatus[] = [
  CampaignStatus.DRAFT,
  CampaignStatus.PAUSED,
];

@Injectable()
export class AdvertiserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly walletManager: WalletManager,
  ) {}

  // --- Profile ---

  async getProfile(advertiserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: advertiserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance_usd: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Advertiser not found');
    }

    return user;
  }

  // --- Create (unchanged) ---

  async createCampaign(advertiserId: string, dto: CreateCampaignDto) {
    if (dto.dailyBudget > dto.totalBudget) {
      throw new BadRequestException('DAILY_BUDGET_EXCEEDS_TOTAL_BUDGET');
    }

    if (dto.creativeType === 'image' && !dto.creativeUrl) {
      throw new BadRequestException('CREATIVE_URL_REQUIRED');
    }

    if (dto.creativeType === 'html' && !dto.creativeHtml) {
      throw new BadRequestException('CREATIVE_HTML_REQUIRED');
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        advertiserId,
        campaignName: dto.campaignName,
        totalBudget: dto.totalBudget,
        dailyBudget: dto.dailyBudget,
        maxCpc: dto.maxCpc,
        targetCountries: this.normalizeList(dto.targetCountries),
        targetDevices: this.normalizeList(dto.targetDevices).map((device) =>
          device.toLowerCase(),
        ),
        creativeType: dto.creativeType,
        creativeUrl: dto.creativeUrl,
        creativeHtml: dto.creativeHtml,
        notes: dto.notes,
        status: CampaignStatus.PENDING_REVIEW,
      },
    });

    return {
      message: 'Campaign submitted for review',
      campaign,
    };
  }

  // --- List / get ---

  async listCampaigns(
    advertiserId: string,
    query: { page?: string; pageSize?: string; status?: string },
  ) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const status = this.parseStatusFilter(query.status);

    const where = { advertiserId, ...(status ? { status } : {}) };

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { campaigns, page, pageSize, total };
  }

  async getCampaign(advertiserId: string, campaignId: string) {
    return this.findOwnedCampaignOrThrow(advertiserId, campaignId);
  }

  // --- Update ---

  async updateCampaign(
    advertiserId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
  ) {
    const campaign = await this.findOwnedCampaignOrThrow(
      advertiserId,
      campaignId,
    );

    if (!EDITABLE_STATUSES.includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot edit a campaign in ${campaign.status} status`,
      );
    }

    const totalBudget = dto.totalBudget ?? Number(campaign.totalBudget);
    const dailyBudget = dto.dailyBudget ?? Number(campaign.dailyBudget);

    if (dailyBudget > totalBudget) {
      throw new BadRequestException('DAILY_BUDGET_EXCEEDS_TOTAL_BUDGET');
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...dto,
        targetCountries: dto.targetCountries
          ? this.normalizeList(dto.targetCountries)
          : undefined,
        targetDevices: dto.targetDevices
          ? this.normalizeList(dto.targetDevices).map((device) =>
              device.toLowerCase(),
            )
          : undefined,
      },
    });
  }

  // --- Lifecycle ---

  async pauseCampaign(advertiserId: string, campaignId: string) {
    return this.transitionCampaign(
      advertiserId,
      campaignId,
      CampaignStatus.PAUSED,
    );
  }

  async resumeCampaign(advertiserId: string, campaignId: string) {
    return this.transitionCampaign(
      advertiserId,
      campaignId,
      CampaignStatus.ACTIVE,
    );
  }

  async archiveCampaign(advertiserId: string, campaignId: string) {
    return this.transitionCampaign(
      advertiserId,
      campaignId,
      CampaignStatus.ARCHIVED,
    );
  }

  async deleteCampaign(advertiserId: string, campaignId: string) {
    const campaign = await this.findOwnedCampaignOrThrow(
      advertiserId,
      campaignId,
    );

    // Only a campaign that never went through review can be hard-deleted.
    // Anything that was ever submitted should be archived instead, so the
    // history/spend record stays intact.
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT campaigns can be deleted - archive it instead',
      );
    }

    await this.prisma.campaign.delete({ where: { id: campaignId } });

    return { message: 'Campaign deleted' };
  }

  private async transitionCampaign(
    advertiserId: string,
    campaignId: string,
    next: CampaignStatus,
  ) {
    const campaign = await this.findOwnedCampaignOrThrow(
      advertiserId,
      campaignId,
    );

    assertTransition(campaign.status, next, CAMPAIGN_TRANSITIONS);

    // Archiving is terminal, so any budget still held for this campaign
    // (reserved via WalletManager.reserveCampaignBudget when an admin
    // approves it - see AdminService.approveCampaign) needs to go back to
    // the advertiser's available balance now, or it stays stuck reserved
    // forever. Campaigns that were never approved (DRAFT/PENDING_REVIEW)
    // simply have nothing reserved, so this is a no-op for them.
    if (
      next === CampaignStatus.ARCHIVED &&
      new Prisma.Decimal(campaign.reservedAmount).greaterThan(0)
    ) {
      await this.walletManager.releaseCampaignReservation(
        advertiserId,
        campaignId,
        campaign.reservedAmount,
        `Reservation released - campaign ${campaign.campaignName} archived`,
      );
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: next },
    });
  }

  // --- Creatives ---

  async listCreatives(advertiserId: string, campaignId: string) {
    const campaign = await this.findOwnedCampaignOrThrow(
      advertiserId,
      campaignId,
    );

    // The schema currently stores one creative per campaign. We still
    // return it as a list so the frontend/API shape won't need to change
    // if multiple creatives per campaign are added later.
    if (!campaign.creativeType) {
      return { creatives: [] };
    }

    return {
      creatives: [
        {
          campaignId: campaign.id,
          creativeType: campaign.creativeType,
          creativeUrl: campaign.creativeUrl,
          creativeHtml: campaign.creativeHtml,
        },
      ],
    };
  }

  // --- Performance / spend / budget ---

  async getCampaignPerformance(
    advertiserId: string,
    campaignId: string,
    startDate: string,
    endDate: string,
  ) {
    await this.findOwnedCampaignOrThrow(advertiserId, campaignId);

    return this.analyticsService.getDailyMetrics(startDate, endDate, {
      campaignId,
    });
  }

  async getCampaignSpend(advertiserId: string, campaignId: string) {
    const campaign = await this.findOwnedCampaignOrThrow(
      advertiserId,
      campaignId,
    );

    const today = this.today();
    const createdOn = campaign.createdAt.toISOString().slice(0, 10);

    const lifetime = await this.analyticsService.getDailyMetrics(
      createdOn,
      today,
      { campaignId },
    );

    return {
      campaignId,
      totalBudget: Number(campaign.totalBudget),
      spendToDate: lifetime.totals.spend,
      remainingBudget: Number(campaign.totalBudget) - lifetime.totals.spend,
    };
  }

  async getCampaignBudgetStatus(advertiserId: string, campaignId: string) {
    const campaign = await this.findOwnedCampaignOrThrow(
      advertiserId,
      campaignId,
    );

    const today = this.today();
    const createdOn = campaign.createdAt.toISOString().slice(0, 10);

    const [todayMetrics, lifetimeMetrics] = await Promise.all([
      this.analyticsService.getDailyMetrics(today, today, { campaignId }),
      this.analyticsService.getDailyMetrics(createdOn, today, { campaignId }),
    ]);

    const totalBudget = Number(campaign.totalBudget);
    const dailyBudget = Number(campaign.dailyBudget);
    const spentToday = todayMetrics.totals.spend;
    const spentTotal = lifetimeMetrics.totals.spend;

    return {
      campaignId,
      status: campaign.status,
      totalBudget,
      dailyBudget,
      spentToday,
      spentTotal,
      remainingToday: Math.max(dailyBudget - spentToday, 0),
      remainingTotal: Math.max(totalBudget - spentTotal, 0),
      dailyBudgetExhausted: spentToday >= dailyBudget,
      totalBudgetExhausted: spentTotal >= totalBudget,
    };
  }

  // --- Helpers ---

  private async findOwnedCampaignOrThrow(
    advertiserId: string,
    campaignId: string,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    // NotFound (not Forbidden) so an advertiser can't tell whether another
    // advertiser's campaign id even exists.
    if (!campaign || campaign.advertiserId !== advertiserId) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  private parseStatusFilter(status?: string) {
    if (!status) {
      return undefined;
    }

    if (!Object.values(CampaignStatus).includes(status as CampaignStatus)) {
      throw new BadRequestException('Invalid status filter');
    }

    return status as CampaignStatus;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private normalizeList(values: string[]) {
    return values
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.toUpperCase());
  }
}
