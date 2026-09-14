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
import { NotificationsService } from '../notifications/notifications.service';
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

const USER_DIRECTORY_SELECT = {
  ...USER_ADMIN_SELECT,
  country: true,
} as const;

const EMPTY_GROUPED_TOTALS = {
  impressions: 0,
  clicks: 0,
  spend: 0,
  payout: 0,
  ctr: 0,
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletManager: WalletManager,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly analyticsService: AnalyticsService,
    private readonly notifications: NotificationsService,
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

  // Backs AdminOverview's stat cards - used to be 5 separate
  // listCampaigns({status, pageSize: 1}) calls (one per CampaignStatus)
  // just to read off each .total, one groupBy instead.
  async getCampaignStatusCounts(): Promise<Record<CampaignStatus, number>> {
    const grouped = await this.prisma.campaign.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      grouped.map((g) => [g.status, g._count._all]),
    ) as Record<CampaignStatus, number>;

    for (const status of Object.values(CampaignStatus)) {
      counts[status] ??= 0;
    }

    return counts;
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

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.ACTIVE },
    });

    this.notifications
      .create({
        userId: campaign.advertiserId,
        type: 'CAMPAIGN_APPROVED',
        title: 'Campaign approved',
        message: `"${campaign.campaignName}" was approved and is now live.`,
        link: `/advertiser/campaigns/${campaign.id}`,
      })
      .catch((error: Error) =>
        console.error('Failed to create notification:', error.message),
      );

    return updated;
  }

  async rejectCampaign(campaignId: string, dto: RejectCampaignDto) {
    const campaign = await this.requireCampaign(campaignId);

    if (campaign.status !== CampaignStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Cannot reject a campaign in ${campaign.status} status`,
      );
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.ARCHIVED,
        notes: dto.reason
          ? this.appendNote(campaign.notes, `[Admin rejection] ${dto.reason}`)
          : campaign.notes,
      },
    });

    this.notifications
      .create({
        userId: campaign.advertiserId,
        type: 'CAMPAIGN_REJECTED',
        title: 'Campaign rejected',
        message: dto.reason
          ? `"${campaign.campaignName}" was rejected: ${dto.reason}`
          : `"${campaign.campaignName}" was rejected.`,
        link: `/advertiser/campaigns/${campaign.id}`,
      })
      .catch((error: Error) =>
        console.error('Failed to create notification:', error.message),
      );

    return updated;
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

  // --- Advertisers directory (master/advertiser-scoped admin) ---
  // Everything MASTER needs to know about one advertiser account in one
  // call: profile, campaigns, lifetime spend, and where in the world their
  // delivered impressions/clicks are landing (via GeoIpService-tagged
  // ClickHouse rows, same country data the publisher-side breakdown uses -
  // see ClickHouseAnalyticsQueryStore).

  async listAdvertisers(query: {
    page?: string;
    pageSize?: string;
    search?: string;
  }) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this.directoryWhere(UserRole.ADVERTISER, query.search);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: USER_DIRECTORY_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = users.map((u) => u.id);
    const campaignStats = userIds.length
      ? await this.prisma.campaign.groupBy({
          by: ['advertiserId'],
          where: { advertiserId: { in: userIds } },
          _count: { _all: true },
          _sum: { spentAmount: true },
        })
      : [];
    const statsByAdvertiser = new Map(
      campaignStats.map((s) => [s.advertiserId, s]),
    );

    const advertisers = users.map((user) => {
      const stats = statsByAdvertiser.get(user.id);
      return {
        ...user,
        campaignCount: stats?._count._all ?? 0,
        totalSpend: new Prisma.Decimal(stats?._sum.spentAmount ?? 0),
      };
    });

    return { advertisers, page, pageSize, total };
  }

  async getAdvertiser(
    advertiserId: string,
    query: { startDate?: string; endDate?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: advertiserId },
      select: USER_DIRECTORY_SELECT,
    });

    if (!user || user.role !== UserRole.ADVERTISER) {
      throw new NotFoundException('Advertiser not found');
    }

    const campaigns = await this.prisma.campaign.findMany({
      where: { advertiserId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        campaignName: true,
        status: true,
        totalBudget: true,
        spentAmount: true,
        targetCountries: true,
        createdAt: true,
      },
    });

    const { startDate, endDate } = this.resolveDateRange(query);
    const campaignIds = campaigns.map((c) => c.id);

    const [byCountry, byDate] = campaignIds.length
      ? await Promise.all([
          this.analyticsService.getGroupedMetrics({
            campaignIds,
            groupBy: 'country',
            startDate,
            endDate,
          }),
          this.analyticsService.getGroupedMetrics({
            campaignIds,
            groupBy: 'date',
            startDate,
            endDate,
          }),
        ])
      : [
          { rows: [], totals: EMPTY_GROUPED_TOTALS },
          { rows: [], totals: EMPTY_GROUPED_TOTALS },
        ];

    return {
      advertiser: user,
      campaigns,
      totalSpend: campaigns.reduce(
        (sum, c) => sum.plus(c.spentAmount),
        new Prisma.Decimal(0),
      ),
      audienceByCountry: byCountry.rows,
      trafficByDate: byDate.rows,
      totals: byCountry.totals,
      range: { startDate, endDate },
    };
  }

  // --- Publishers directory (master/publisher-scoped admin) ---
  // Mirror of the advertiser directory above, but scoped by this
  // publisher's ad zones (not campaigns) - profile, sites, payout history,
  // and their audience's country breakdown.

  async listPublishers(query: {
    page?: string;
    pageSize?: string;
    search?: string;
  }) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this.directoryWhere(UserRole.PUBLISHER, query.search);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          ...USER_DIRECTORY_SELECT,
          wallet: {
            select: {
              totalEarned: true,
              totalWithdrawn: true,
              pendingEarnings: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = users.map((u) => u.id);
    const siteStats = userIds.length
      ? await this.prisma.publisherSite.groupBy({
          by: ['publisherId'],
          where: { publisherId: { in: userIds } },
          _count: { _all: true },
        })
      : [];
    const siteCountByPublisher = new Map(
      siteStats.map((s) => [s.publisherId, s._count._all]),
    );

    const publishers = users.map((user) => ({
      ...user,
      siteCount: siteCountByPublisher.get(user.id) ?? 0,
      totalEarned: new Prisma.Decimal(user.wallet?.totalEarned ?? 0),
      pendingEarnings: new Prisma.Decimal(user.wallet?.pendingEarnings ?? 0),
      totalWithdrawn: new Prisma.Decimal(user.wallet?.totalWithdrawn ?? 0),
    }));

    return { publishers, page, pageSize, total };
  }

  async getPublisher(
    publisherId: string,
    query: { startDate?: string; endDate?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: publisherId },
      select: {
        ...USER_DIRECTORY_SELECT,
        wallet: {
          select: {
            totalEarned: true,
            totalWithdrawn: true,
            pendingEarnings: true,
          },
        },
      },
    });

    if (!user || user.role !== UserRole.PUBLISHER) {
      throw new NotFoundException('Publisher not found');
    }

    const [sites, zones, payouts] = await Promise.all([
      this.prisma.publisherSite.findMany({
        where: { publisherId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          domain: true,
          status: true,
          verified: true,
          country: true,
          createdAt: true,
        },
      }),
      this.prisma.adZone.findMany({
        where: { publisherId },
        select: { id: true },
      }),
      this.prisma.payout.findMany({
        where: { userId: publisherId },
        orderBy: { requestedAt: 'desc' },
        take: 25,
      }),
    ]);

    const { startDate, endDate } = this.resolveDateRange(query);
    const zoneIds = zones.map((z) => z.id);

    const [byCountry, byDate] = zoneIds.length
      ? await Promise.all([
          this.analyticsService.getGroupedMetrics({
            zoneIds,
            groupBy: 'country',
            startDate,
            endDate,
          }),
          this.analyticsService.getGroupedMetrics({
            zoneIds,
            groupBy: 'date',
            startDate,
            endDate,
          }),
        ])
      : [
          { rows: [], totals: EMPTY_GROUPED_TOTALS },
          { rows: [], totals: EMPTY_GROUPED_TOTALS },
        ];

    return {
      publisher: {
        ...user,
        totalEarned: new Prisma.Decimal(user.wallet?.totalEarned ?? 0),
        pendingEarnings: new Prisma.Decimal(user.wallet?.pendingEarnings ?? 0),
        totalWithdrawn: new Prisma.Decimal(user.wallet?.totalWithdrawn ?? 0),
      },
      sites,
      payouts,
      audienceByCountry: byCountry.rows,
      trafficByDate: byDate.rows,
      totals: byCountry.totals,
      range: { startDate, endDate },
    };
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

  async getMinAdvertiserBalance() {
    const minAdvertiserBalanceUsd =
      await this.platformSettingsService.getMinAdvertiserBalanceUsd();
    return { minAdvertiserBalanceUsd: minAdvertiserBalanceUsd.toString() };
  }

  async updateMinAdvertiserBalance(amount: number) {
    return this.platformSettingsService.updateMinAdvertiserBalanceUsd(amount);
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

  // Shared by listAdvertisers/listPublishers - filters to one role plus an
  // optional case-insensitive name/email substring search.
  private directoryWhere(
    role: UserRole,
    search?: string,
  ): Prisma.UserWhereInput {
    const trimmed = search?.trim();
    return {
      role,
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: 'insensitive' } },
              { email: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  // Defaults the advertiser/publisher drill-down's traffic window to the
  // trailing 30 days when the caller doesn't pick a range - mirrors the
  // publisher Statistics page's default (see PublisherService).
  private resolveDateRange(query: { startDate?: string; endDate?: string }) {
    if (query.startDate && query.endDate) {
      return { startDate: query.startDate, endDate: query.endDate };
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
    return {
      startDate: query.startDate ?? toIsoDate(start),
      endDate: query.endDate ?? toIsoDate(end),
    };
  }

  private parseVerifiedFilter(verified?: string) {
    if (verified === undefined) return undefined;
    if (verified === 'true') return true;
    if (verified === 'false') return false;

    throw new BadRequestException('Invalid verified filter');
  }
}
