import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, SiteStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WalletManager } from '../wallet/wallet-manager.service';
import { parsePagination } from '../common/pagination.util';
import { RejectCampaignDto } from './dto/reject-campaign.dto';

const ADVERTISER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

const USER_ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  balance_usd: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletManager: WalletManager,
  ) {}

  // --- Campaign review ---
  // Campaigns are created as PENDING_REVIEW (see AdvertiserService) and the
  // advertiser-facing endpoints deliberately can't move that to ACTIVE (see
  // campaign-status.util.ts) - approving/rejecting here is that missing
  // decision point.

  async listCampaigns(query: {
    page?: string;
    pageSize?: string;
    status?: string;
  }) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const status = this.parseCampaignStatusFilter(query.status);
    const where = status ? { status } : {};

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { advertiser: { select: ADVERTISER_SUMMARY_SELECT } },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { campaigns, page, pageSize, total };
  }

  async getCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { advertiser: { select: ADVERTISER_SUMMARY_SELECT } },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async approveCampaign(campaignId: string) {
    const campaign = await this.requireCampaign(campaignId);

    if (campaign.status !== CampaignStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Cannot approve a campaign in ${campaign.status} status`,
      );
    }

    // Hold the full budget out of the advertiser's available balance now
    // that it's going live - mirrors the comment on Campaign.reservedAmount
    // in schema.prisma. Throws (409) if the advertiser doesn't have enough
    // available balance, which correctly blocks the approval.
    await this.walletManager.reserveCampaignBudget(
      campaign.advertiserId,
      campaign.id,
      campaign.totalBudget,
    );

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.ACTIVE },
    });
  }

  async rejectCampaign(campaignId: string, dto: RejectCampaignDto) {
    const campaign = await this.requireCampaign(campaignId);

    if (campaign.status !== CampaignStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Cannot reject a campaign in ${campaign.status} status`,
      );
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.ARCHIVED,
        notes: dto.reason
          ? this.appendNote(campaign.notes, `[Admin rejection] ${dto.reason}`)
          : campaign.notes,
      },
    });
  }

  // --- Users (read-only: no suspend/ban action exists on the backend yet) ---

  async listUsers(query: { page?: string; pageSize?: string; role?: string }) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const role = this.parseRoleFilter(query.role);
    const where = role ? { role } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: USER_ADMIN_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, page, pageSize, total };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_ADMIN_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // --- Publisher sites (cross-publisher moderation) ---

  async listSites(query: {
    page?: string;
    pageSize?: string;
    status?: string;
    verified?: string;
  }) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const status = this.parseSiteStatusFilter(query.status);
    const verified = this.parseVerifiedFilter(query.verified);
    const where = {
      ...(status ? { status } : {}),
      ...(verified === undefined ? {} : { verified }),
    };

    const [sites, total] = await Promise.all([
      this.prisma.publisherSite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { publisher: { select: ADVERTISER_SUMMARY_SELECT } },
      }),
      this.prisma.publisherSite.count({ where }),
    ]);

    return { sites, page, pageSize, total };
  }

  async getSite(siteId: string) {
    const site = await this.prisma.publisherSite.findUnique({
      where: { id: siteId },
      include: { publisher: { select: ADVERTISER_SUMMARY_SELECT } },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    return site;
  }

  async updateSiteStatus(siteId: string, status: SiteStatus) {
    await this.getSite(siteId);

    return this.prisma.publisherSite.update({
      where: { id: siteId },
      data: { status },
    });
  }

  // --- Helpers ---

  private async requireCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  private appendNote(existing: string | null, addition: string) {
    return existing ? `${existing}\n\n${addition}` : addition;
  }

  private parseCampaignStatusFilter(status?: string) {
    if (!status) return undefined;

    if (!Object.values(CampaignStatus).includes(status as CampaignStatus)) {
      throw new BadRequestException('Invalid status filter');
    }

    return status as CampaignStatus;
  }

  private parseSiteStatusFilter(status?: string) {
    if (!status) return undefined;

    if (!Object.values(SiteStatus).includes(status as SiteStatus)) {
      throw new BadRequestException('Invalid status filter');
    }

    return status as SiteStatus;
  }

  private parseRoleFilter(role?: string) {
    if (!role) return undefined;

    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestException('Invalid role filter');
    }

    return role as UserRole;
  }

  private parseVerifiedFilter(verified?: string) {
    if (verified === undefined) return undefined;
    if (verified === 'true') return true;
    if (verified === 'false') return false;

    throw new BadRequestException('Invalid verified filter');
  }
}
