import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  Prisma,
  SiteStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';

import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletManager } from '../wallet/wallet-manager.service';
import { parsePagination } from '../common/pagination.util';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
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
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly analyticsService: AnalyticsService,
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

  // `callerAdminScope` pins the role filter for a scoped admin so a
  // PUBLISHER-scoped admin can never page through advertiser accounts (or
  // vice versa) regardless of what `?role=` was requested - MASTER (or a
  // legacy admin with no scope set) is unrestricted, same as
  // AdminScopeGuard's own MASTER bypass.
  async listUsers(
    query: { page?: string; pageSize?: string; role?: string },
    callerAdminScope?: string | null,
  ) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const requestedRole = this.parseRoleFilter(query.role);
    const pinnedRole = this.pinRoleToScope(callerAdminScope);
    const role = pinnedRole ?? requestedRole;
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

  async getUser(userId: string, callerAdminScope?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_ADMIN_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const pinnedRole = this.pinRoleToScope(callerAdminScope);
    if (pinnedRole && user.role !== pinnedRole) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private pinRoleToScope(
    callerAdminScope?: string | null,
  ): UserRole | undefined {
    if (callerAdminScope === 'PUBLISHER') return UserRole.PUBLISHER;
    if (callerAdminScope === 'ADVERTISER') return UserRole.ADVERTISER;
    return undefined;
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

  // --- Platform settings ---

  async getPlatformFee() {
    const platformFeeBps = await this.platformSettingsService.getPlatformFeeBps();

    return { platformFeeBps, platformFeePercent: platformFeeBps / 100 };
  }

  async getAdFormatPricing() {
    return this.platformSettingsService.getAdFormatPricing();
  }

  async updateAdFormatPricing(dto: {
    adFormat: string;
    cpm: number;
    cpa: number;
    cpc: number;
  }) {
    return this.platformSettingsService.updateAdFormatPricing(dto.adFormat, {
      cpm: dto.cpm,
      cpa: dto.cpa,
      cpc: dto.cpc,
    });
  }

  async updatePlatformFee(platformFeeBps: number) {
    const updated =
      await this.platformSettingsService.updatePlatformFeeBps(platformFeeBps);

    return {
      platformFeeBps: updated.platformFeeBps,
      platformFeePercent: updated.platformFeeBps / 100,
    };
  }

  async getUsdToInrRate() {
    const rate = await this.platformSettingsService.getUsdToInrRate();
    return { usdToInrRate: rate.toString() };
  }

  async updateUsdToInrRate(rate: number) {
    return this.platformSettingsService.updateUsdToInrRate(rate);
  }

  // --- Revenue (platform-wide financial rollup) ---
  // Lifetime totals pulled straight from the Postgres ledger (source of
  // truth for money), not ClickHouse - ClickHouse's spend/payout columns
  // apply the SAME live platformFeeBps (see
  // ClickHouseAnalyticsQueryStore.getDailyMetrics) but only cover the
  // event-stream window, so this endpoint is the one place that reports
  // the network's all-time position. Note the ClickHouse side applies
  // TODAY's rate to all historical rows (it doesn't store the rate that was
  // actually in effect when each event billed), so it's an approximation -
  // this endpoint's numbers come straight from what was actually credited
  // per-transaction and are exact.
  async getRevenueSummary() {
    const [campaignSpend, walletTotals, completedPayouts, pendingPayouts] =
      await Promise.all([
        this.prisma.campaign.aggregate({ _sum: { spentAmount: true } }),
        this.prisma.wallet.aggregate({
          _sum: { totalEarned: true, totalWithdrawn: true, totalDeposited: true },
        }),
        this.prisma.payout.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        this.prisma.payout.aggregate({
          where: { status: { in: ['REQUESTED', 'PROCESSING'] } },
          _count: true,
          _sum: { amount: true },
        }),
      ]);

    // Aggregates come back null (not zero) when there are no matching rows -
    // normalize to Decimal(0) so every field below is consistently a Decimal,
    // same as every other money field this API returns.
    const totalAdSpend = new Prisma.Decimal(campaignSpend._sum.spentAmount ?? 0);
    const totalPublisherEarned = new Prisma.Decimal(
      walletTotals._sum.totalEarned ?? 0,
    );
    const totalWithdrawn = new Prisma.Decimal(
      walletTotals._sum.totalWithdrawn ?? 0,
    );
    const totalDeposited = new Prisma.Decimal(
      walletTotals._sum.totalDeposited ?? 0,
    );
    const totalPayoutsCompleted = new Prisma.Decimal(
      completedPayouts._sum.amount ?? 0,
    );
    const pendingPayoutAmount = new Prisma.Decimal(
      pendingPayouts._sum.amount ?? 0,
    );

    // Gross platform revenue = money billed to advertisers minus the share
    // credited to publishers for delivering it (the 70% cut).
    const platformRevenue = this.subtract(totalAdSpend, totalPublisherEarned);
    // What's still owed to publishers but hasn't been paid out yet.
    const outstandingPublisherLiability = this.subtract(
      totalPublisherEarned,
      totalWithdrawn,
    );

    return {
      totalAdSpend,
      totalPublisherEarned,
      platformRevenue,
      totalDeposited,
      totalPayoutsCompleted,
      outstandingPublisherLiability,
      pendingPayoutCount: pendingPayouts._count,
      pendingPayoutAmount,
    };
  }

  // --- Revenue breakdown ("how the cut works") ---
  // Master-admin-only (see AdminController) - a plain-English + worked-
  // example explanation of exactly how the platform fee is applied to every
  // billed event, backed by real recent AD_SPEND/PUBLISHER_EARNING ledger
  // pairs so it's not just a formula but visible proof of what actually
  // happened. AD_SPEND and PUBLISHER_EARNING for the same billed event (one
  // click, one CPM batch, one CPA conversion) always share a referenceId -
  // see AdBillingService - so pairing on that column reconstructs exactly
  // what the advertiser was charged, what the publisher was credited, and
  // what the platform kept, per event.
  async getRevenueBreakdown() {
    const feeBps = await this.platformSettingsService.getPlatformFeeBps();
    const feePercent = new Prisma.Decimal(feeBps).dividedBy(100);
    const publisherPercent = new Prisma.Decimal(100).minus(feePercent);

    const exampleAdvertiserCharge = new Prisma.Decimal(100);
    const examplePublisherShare = this.platformSettingsService.publisherShareOf(
      exampleAdvertiserCharge,
      feeBps,
    );
    const examplePlatformCut = exampleAdvertiserCharge.minus(
      examplePublisherShare,
    );

    const recentSpend = await this.prisma.walletTransaction.findMany({
      where: { type: TransactionType.AD_SPEND },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        userId: true,
        amount: true,
        referenceId: true,
        description: true,
        createdAt: true,
      },
    });

    const referenceIds = recentSpend
      .map((tx) => tx.referenceId)
      .filter((id): id is string => Boolean(id));

    const matchingEarnings = referenceIds.length
      ? await this.prisma.walletTransaction.findMany({
          where: {
            type: TransactionType.PUBLISHER_EARNING,
            referenceId: { in: referenceIds },
          },
          select: { referenceId: true, amount: true, userId: true },
        })
      : [];

    const earningByReferenceId = new Map(
      matchingEarnings.map((tx) => [tx.referenceId, tx]),
    );

    // WalletTransaction only stores a bare userId (no relation) - batch-load
    // the advertiser/publisher names for every user touched by these rows in
    // one query rather than N+1ing it.
    const involvedUserIds = Array.from(
      new Set([
        ...recentSpend.map((tx) => tx.userId),
        ...matchingEarnings.map((tx) => tx.userId),
      ]),
    );
    const involvedUsers = involvedUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: involvedUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userById = new Map(involvedUsers.map((u) => [u.id, u]));

    // Every row here is a real, already-settled billing event - each one
    // proves advertiserCharged = publisherPaid + platformKept for that exact
    // referenceId, not just the aggregate totals above.
    const recentEvents = recentSpend.map((spend) => {
      const earning = spend.referenceId
        ? earningByReferenceId.get(spend.referenceId)
        : undefined;
      const advertiserCharged = new Prisma.Decimal(spend.amount);
      const publisherPaid = earning
        ? new Prisma.Decimal(earning.amount)
        : null;
      const platformKept = publisherPaid
        ? advertiserCharged.minus(publisherPaid)
        : null;
      const advertiser = userById.get(spend.userId);
      const publisher = earning ? userById.get(earning.userId) : undefined;

      return {
        referenceId: spend.referenceId,
        description: spend.description,
        occurredAt: spend.createdAt,
        advertiser: advertiser
          ? { name: advertiser.name, email: advertiser.email }
          : null,
        publisher: publisher
          ? { name: publisher.name, email: publisher.email }
          : null,
        advertiserCharged,
        publisherPaid,
        platformKept,
        // Null when the matching PUBLISHER_EARNING row hasn't been found
        // (e.g. the publisher credit failed and is pending manual
        // reconciliation - see AdBillingService.creditPublisherShare) rather
        // than silently showing $0.
        settled: publisherPaid !== null,
      };
    });

    return {
      platformFeeBps: feeBps,
      platformFeePercent: feePercent,
      publisherSharePercent: publisherPercent,
      explanation:
        `Every time an ad is billed (per click, per 1000 impressions, or per verified conversion, ` +
        `depending on the campaign's pricing model), the advertiser's wallet is charged the FULL rate ` +
        `card amount. The publisher who delivered it is then credited ${publisherPercent.toFixed(2)}% of ` +
        `that amount into their pending earnings. The remaining ${feePercent.toFixed(2)}% is the ` +
        `platform's cut and is never credited to anyone - it simply isn't paid out, so it stays the ` +
        `difference between total ad spend and total publisher earnings.`,
      worked_example: {
        advertiserCharged: exampleAdvertiserCharge,
        publisherPaid: examplePublisherShare,
        platformKept: examplePlatformCut,
      },
      recentEvents,
    };
  }

  // --- Traffic quality / fraud protection (platform-wide) ---
  // See PublisherService.getTrafficQuality and
  // AdvertiserService.getTrafficQuality for the equivalent zone-/campaign-
  // scoped views - this is the unscoped, every-tenant admin rollup.

  async getTrafficQuality(query: { startDate: string; endDate: string }) {
    return this.analyticsService.getTrafficQuality({
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  async listBlacklistedIps(query: { page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePagination(query);

    const [total, ips] = await Promise.all([
      this.prisma.blacklistedIp.count(),
      this.prisma.blacklistedIp.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ips,
      page,
      pageSize,
      total,
    };
  }

  // Manual add - the automated path (a honeypot hit) goes through
  // FraudDetectionService.recordHoneypotHit instead, which always sets
  // source 'HONEYPOT'. This is for an admin blocking an IP off other
  // evidence (dashboard traffic patterns, an external abuse report, ...).
  async addBlacklistedIp(ipAddress: string, reason: string) {
    const normalizedIp = ipAddress.replace('::ffff:', '').split(',')[0].trim();

    if (!normalizedIp) {
      throw new BadRequestException('ipAddress is required');
    }

    return this.prisma.blacklistedIp.upsert({
      where: { ipAddress: normalizedIp },
      update: { source: 'MANUAL', reason },
      create: { ipAddress: normalizedIp, source: 'MANUAL', reason },
    });
  }

  async removeBlacklistedIp(id: string) {
    try {
      await this.prisma.blacklistedIp.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Blacklisted IP not found');
    }

    return { removed: true };
  }

  // --- Helpers ---

  private subtract(
    a: Prisma.Decimal | number,
    b: Prisma.Decimal | number,
  ) {
    return new Prisma.Decimal(a).minus(new Prisma.Decimal(b));
  }

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
