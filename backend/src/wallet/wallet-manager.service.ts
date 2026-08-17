import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Campaign,
  CampaignStatus,
  Payout,
  PayoutStatus,
  Prisma,
  TransactionType,
  Wallet,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../common/pagination.util';
import { PAYOUT_PROVIDER } from './payout-providers/payout-provider.interface';
import type { PayoutProvider } from './payout-providers/payout-provider.interface';
import { ManualPayoutProvider } from './payout-providers/manual-payout.provider';

type WalletAmount = Prisma.Decimal | number | string;

type LockedWalletRow = {
  balance_usd: Prisma.Decimal | number | string;
};

type LockedWalletTableRow = {
  id: string;
  reservedBalance: Prisma.Decimal | number | string;
  pendingEarnings: Prisma.Decimal | number | string;
  totalDeposited: Prisma.Decimal | number | string;
  totalSpent: Prisma.Decimal | number | string;
  totalEarned: Prisma.Decimal | number | string;
  totalWithdrawn: Prisma.Decimal | number | string;
  currency: string;
};

type LockedCampaignRow = {
  id: string;
  advertiserId: string;
  status: CampaignStatus;
  totalBudget: Prisma.Decimal | number | string;
  reservedAmount: Prisma.Decimal | number | string;
  spentAmount: Prisma.Decimal | number | string;
};

const MIN_PAYOUT_USD = new Prisma.Decimal(process.env.MIN_PAYOUT_USD ?? '20');

// Tables that hold a monetary balance and need row-level locking inside a
// transaction to stay race-free (double spends, over-reservation, etc). Lock
// order is always User -> Wallet -> Campaign so concurrent operations that
// touch more than one of these never deadlock against each other.
@Injectable()
export class WalletManager {
  private readonly payoutProvider: PayoutProvider;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(PAYOUT_PROVIDER) payoutProvider?: PayoutProvider,
  ) {
    this.payoutProvider = payoutProvider ?? new ManualPayoutProvider();
  }

  // --- Original primitives (unchanged behaviour/signature) ---

  async deduct(userId: string, amountUsd: WalletAmount) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      const [wallet] = await tx.$queryRaw<LockedWalletRow[]>`
        SELECT balance_usd
        FROM "User"
        WHERE id = ${userId}
        FOR UPDATE
      `;

      if (!wallet) {
        throw new NotFoundException('Wallet owner not found');
      }

      const currentBalance = new Prisma.Decimal(wallet.balance_usd);

      if (currentBalance.lessThan(amount)) {
        throw new ConflictException('Insufficient wallet balance');
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          balance_usd: {
            decrement: amount,
          },
        },
        select: {
          id: true,
          balance_usd: true,
        },
      });
    });
  }

  async credit(userId: string, amountUsd: WalletAmount) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      const [wallet] = await tx.$queryRaw<LockedWalletRow[]>`
        SELECT balance_usd
        FROM "User"
        WHERE id = ${userId}
        FOR UPDATE
      `;

      if (!wallet) {
        throw new NotFoundException('Wallet owner not found');
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          balance_usd: {
            increment: amount,
          },
        },
        select: {
          id: true,
          balance_usd: true,
        },
      });
    });
  }

  // --- Wallet summary / history ---

  async getWallet(userId: string) {
    const user = await this.requireUser(userId);
    const wallet = await this.getOrCreateWallet(userId);

    return this.shapeWallet(user.role, user.balance_usd, wallet);
  }

  async getSummary(userId: string) {
    const user = await this.requireUser(userId);
    const wallet = await this.getOrCreateWallet(userId);
    const shaped = this.shapeWallet(user.role, user.balance_usd, wallet);

    if (user.role === 'ADVERTISER') {
      const campaigns = await this.prisma.campaign.findMany({
        where: { advertiserId: userId },
        select: {
          id: true,
          campaignName: true,
          status: true,
          totalBudget: true,
          reservedAmount: true,
          spentAmount: true,
        },
      });

      return {
        ...shaped,
        campaignSpending: campaigns.map((campaign) => ({
          campaignId: campaign.id,
          campaignName: campaign.campaignName,
          status: campaign.status,
          totalBudget: campaign.totalBudget,
          reserved: campaign.reservedAmount,
          spent: campaign.spentAmount,
          remaining: new Prisma.Decimal(campaign.totalBudget)
            .minus(campaign.reservedAmount)
            .minus(campaign.spentAmount),
        })),
      };
    }

    if (user.role === 'PUBLISHER') {
      const [pendingPayouts, lifetimePayouts] = await Promise.all([
        this.prisma.payout.count({
          where: {
            walletId: wallet.id,
            status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] },
          },
        }),
        this.prisma.payout.aggregate({
          where: { walletId: wallet.id, status: PayoutStatus.COMPLETED },
          _sum: { amount: true },
        }),
      ]);

      return {
        ...shaped,
        pendingPayoutCount: pendingPayouts,
        lifetimePayoutsCompleted:
          lifetimePayouts._sum.amount ?? new Prisma.Decimal(0),
        minimumPayoutThreshold: MIN_PAYOUT_USD,
      };
    }

    return shaped;
  }

  async listTransactions(
    userId: string,
    query: {
      page?: string;
      pageSize?: string;
      type?: string;
    },
  ) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const type = this.parseTransactionTypeFilter(query.type);
    const wallet = await this.getOrCreateWallet(userId);

    const where = { walletId: wallet.id, ...(type ? { type } : {}) };

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return { transactions, page, pageSize, total };
  }

  // --- Deposits (advertiser: add funds) ---

  async deposit(
    userId: string,
    amountUsd: WalletAmount,
    options: { referenceId?: string; description?: string } = {},
  ) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const wallet = await this.lockOrCreateWallet(tx, userId);

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId,
        type: TransactionType.DEPOSIT,
        amount,
        referenceId: options.referenceId,
        description: options.description ?? 'Wallet deposit',
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { totalDeposited: { increment: amount } },
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance_usd: { increment: amount } },
        select: { id: true, balance_usd: true },
      });

      return {
        message: 'Deposit successful',
        balance: updatedUser.balance_usd,
        amount,
      };
    });
  }

  // --- Campaign budget reservation / spend / refund ---

  async reserveCampaignBudget(
    advertiserId: string,
    campaignId: string,
    amountUsd: WalletAmount,
  ) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, advertiserId);
      const wallet = await this.lockOrCreateWallet(tx, advertiserId);
      const campaign = await this.lockOwnedCampaign(
        tx,
        advertiserId,
        campaignId,
      );

      const [freshUser] = await tx.$queryRaw<LockedWalletRow[]>`
        SELECT balance_usd FROM "User" WHERE id = ${advertiserId} FOR UPDATE
      `;
      const available = new Prisma.Decimal(freshUser.balance_usd);

      if (available.lessThan(amount)) {
        throw new ConflictException('INSUFFICIENT_AVAILABLE_BALANCE');
      }

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId: advertiserId,
        type: TransactionType.CAMPAIGN_RESERVATION,
        amount,
        referenceId: campaignId,
        description: `Budget reserved for campaign ${campaignId}`,
      });

      await tx.user.update({
        where: { id: advertiserId },
        data: { balance_usd: { decrement: amount } },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { reservedBalance: { increment: amount } },
      });

      return tx.campaign.update({
        where: { id: campaign.id },
        data: { reservedAmount: { increment: amount } },
      });
    });
  }

  // Moves reserved-but-unspent funds back to the advertiser's available
  // balance - used when a campaign budget is lowered, paused, or archived
  // with money still held against it.
  async releaseCampaignReservation(
    advertiserId: string,
    campaignId: string,
    amountUsd: WalletAmount,
    reason = 'Reservation released',
  ) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, advertiserId);
      const wallet = await this.lockOrCreateWallet(tx, advertiserId);
      const campaign = await this.lockOwnedCampaign(
        tx,
        advertiserId,
        campaignId,
      );

      const reserved = new Prisma.Decimal(campaign.reservedAmount);
      if (reserved.lessThan(amount)) {
        throw new ConflictException('RESERVATION_EXCEEDS_HELD_AMOUNT');
      }

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId: advertiserId,
        type: TransactionType.REFUND,
        amount,
        referenceId: `${campaignId}:release:${Date.now()}`,
        description: reason,
      });

      await tx.user.update({
        where: { id: advertiserId },
        data: { balance_usd: { increment: amount } },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { reservedBalance: { decrement: amount } },
      });

      return tx.campaign.update({
        where: { id: campaign.id },
        data: { reservedAmount: { decrement: amount } },
      });
    });
  }

  // The atomic campaign-spend flow described in the wallet spec:
  //   1. campaign must be ACTIVE
  //   2. reserved funds must cover the spend
  //   3. move reserved -> spent, ledger it, bump campaign.spentAmount
  // `referenceId` should be a stable id for the billed event (e.g. a click
  // or an aggregation bucket id) so the unique ledger constraint rejects a
  // retry/duplicate delivery instead of billing twice.
  async recordCampaignSpend(
    campaignId: string,
    amountUsd: WalletAmount,
    referenceId: string,
    description = 'Ad spend',
  ) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      const [campaignRow] = await tx.$queryRaw<LockedCampaignRow[]>`
        SELECT id, "advertiserId", status, "totalBudget", "reservedAmount", "spentAmount"
        FROM "Campaign"
        WHERE id = ${campaignId}
        FOR UPDATE
      `;

      if (!campaignRow) {
        throw new NotFoundException('Campaign not found');
      }

      if (campaignRow.status !== CampaignStatus.ACTIVE) {
        throw new ConflictException('CAMPAIGN_NOT_ACTIVE');
      }

      const wallet = await this.lockOrCreateWallet(
        tx,
        campaignRow.advertiserId,
      );

      const reserved = new Prisma.Decimal(campaignRow.reservedAmount);
      if (reserved.lessThan(amount)) {
        throw new ConflictException('INSUFFICIENT_RESERVED_BUDGET');
      }

      // Unique (walletId, type, referenceId) makes this a no-op-on-retry
      // guard: a duplicate delivery of the same billed event throws instead
      // of creating a second AD_SPEND row.
      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId: campaignRow.advertiserId,
        type: TransactionType.AD_SPEND,
        amount,
        referenceId,
        description,
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          reservedBalance: { decrement: amount },
          totalSpent: { increment: amount },
        },
      });

      return tx.campaign.update({
        where: { id: campaignId },
        data: {
          reservedAmount: { decrement: amount },
          spentAmount: { increment: amount },
        },
      });
    });
  }

  // --- Publisher earnings ---

  // Credits a publisher for delivered inventory. Earnings land in
  // `pendingEarnings` by default (a short hold before they're withdrawable,
  // mirroring how ad networks clear invalid-traffic/chargebacks) - pass
  // `immediate: true` to skip the hold and make them available right away.
  async creditPublisherEarning(
    publisherId: string,
    amountUsd: WalletAmount,
    options: {
      referenceId: string;
      description?: string;
      immediate?: boolean;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, publisherId);
      const wallet = await this.lockOrCreateWallet(tx, publisherId);

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId: publisherId,
        type: TransactionType.PUBLISHER_EARNING,
        amount,
        referenceId: options.referenceId,
        description: options.description ?? 'Publisher earning',
        metadata: options.metadata,
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          totalEarned: { increment: amount },
          ...(options.immediate
            ? {}
            : { pendingEarnings: { increment: amount } }),
        },
      });

      if (options.immediate) {
        await tx.user.update({
          where: { id: publisherId },
          data: { balance_usd: { increment: amount } },
        });
      }

      return this.getOrCreateWallet(publisherId, tx);
    });
  }

  // Moves cleared pending earnings into the publisher's available/withdrawable
  // balance once the holding period is over.
  async promotePendingEarnings(publisherId: string, amountUsd: WalletAmount) {
    const amount = this.normalizeAmount(amountUsd);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, publisherId);
      const wallet = await this.lockOrCreateWallet(tx, publisherId);

      const pending = new Prisma.Decimal(wallet.pendingEarnings);
      if (pending.lessThan(amount)) {
        throw new ConflictException('INSUFFICIENT_PENDING_EARNINGS');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { pendingEarnings: { decrement: amount } },
      });

      return tx.user.update({
        where: { id: publisherId },
        data: { balance_usd: { increment: amount } },
        select: { id: true, balance_usd: true },
      });
    });
  }

  // --- Payouts ---

  async requestPayout(
    publisherId: string,
    amountUsd: WalletAmount,
    options: { idempotencyKey?: string } = {},
  ) {
    const amount = this.normalizeAmount(amountUsd);

    if (amount.lessThan(MIN_PAYOUT_USD)) {
      throw new BadRequestException(
        `Minimum payout amount is ${MIN_PAYOUT_USD.toFixed(2)}`,
      );
    }

    const payout = await this.prisma.$transaction(async (tx) => {
      const [freshUser] = await tx.$queryRaw<LockedWalletRow[]>`
        SELECT balance_usd FROM "User" WHERE id = ${publisherId} FOR UPDATE
      `;

      if (!freshUser) {
        throw new NotFoundException('Wallet owner not found');
      }

      const wallet = await this.lockOrCreateWallet(tx, publisherId);
      const available = new Prisma.Decimal(freshUser.balance_usd);

      if (available.lessThan(amount)) {
        throw new ConflictException('INSUFFICIENT_AVAILABLE_BALANCE');
      }

      const created = await tx.payout.create({
        data: {
          walletId: wallet.id,
          userId: publisherId,
          amount,
          currency: wallet.currency,
          status: PayoutStatus.REQUESTED,
          provider: this.payoutProvider.name,
        },
      });

      // Hold the funds immediately so the same balance can't be requested
      // twice while this payout is in flight.
      await tx.user.update({
        where: { id: publisherId },
        data: { balance_usd: { decrement: amount } },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { reservedBalance: { increment: amount } },
      });

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId: publisherId,
        type: TransactionType.PAYOUT_REQUEST,
        amount,
        referenceId: options.idempotencyKey ?? created.id,
        description: `Payout requested (${created.id})`,
      });

      return created;
    });

    return this.submitToProvider(payout);
  }

  async listPayouts(
    userId: string,
    query: { page?: string; pageSize?: string; status?: string },
  ) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const status = this.parsePayoutStatusFilter(query.status);
    const where = { userId, ...(status ? { status } : {}) };

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { payouts, page, pageSize, total };
  }

  // Admin/ops view across every publisher's payouts (listPayouts above is
  // scoped to the calling user). Joins through Wallet since Payout only
  // carries a bare userId, no direct User relation.
  async adminListPayouts(query: {
    page?: string;
    pageSize?: string;
    status?: string;
  }) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const status = this.parsePayoutStatusFilter(query.status);
    const where = status ? { status } : {};

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take,
        include: {
          wallet: {
            select: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { payouts, page, pageSize, total };
  }

  async getPayout(userId: string, payoutId: string, isAdmin = false) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    // NotFound (not Forbidden) for a payout owned by someone else, same
    // reasoning as the rest of the app's ownership checks.
    if (!payout || (!isAdmin && payout.userId !== userId)) {
      throw new NotFoundException('Payout not found');
    }

    return payout;
  }

  // Ops/admin confirms the transfer actually landed.
  async completePayout(payoutId: string, providerRef?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await this.lockPayout(tx, payoutId);

      if (payout.status === PayoutStatus.COMPLETED) {
        return payout;
      }

      if (payout.status === PayoutStatus.FAILED) {
        throw new ConflictException('PAYOUT_ALREADY_FAILED');
      }

      const wallet = await this.lockOrCreateWallet(tx, payout.userId);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          reservedBalance: { decrement: payout.amount },
          totalWithdrawn: { increment: payout.amount },
        },
      });

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId: payout.userId,
        type: TransactionType.PAYOUT_COMPLETED,
        amount: payout.amount,
        referenceId: payout.id,
        description: `Payout completed (${payout.id})`,
      });

      return tx.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.COMPLETED,
          processedAt: new Date(),
          providerRef: providerRef ?? payout.providerRef,
        },
      });
    });
  }

  // Ops/admin marks a payout as failed - the held funds go back to the
  // publisher's available balance.
  async failPayout(payoutId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await this.lockPayout(tx, payoutId);

      if (payout.status === PayoutStatus.COMPLETED) {
        throw new ConflictException('PAYOUT_ALREADY_COMPLETED');
      }

      if (payout.status === PayoutStatus.FAILED) {
        return payout;
      }

      const wallet = await this.lockOrCreateWallet(tx, payout.userId);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { reservedBalance: { decrement: payout.amount } },
      });

      await tx.user.update({
        where: { id: payout.userId },
        data: { balance_usd: { increment: payout.amount } },
      });

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        userId: payout.userId,
        type: TransactionType.PAYOUT_FAILED,
        amount: payout.amount,
        referenceId: payout.id,
        description: reason ?? `Payout failed (${payout.id})`,
      });

      return tx.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.FAILED,
          processedAt: new Date(),
          failureReason: reason ?? 'Payout failed',
        },
      });
    });
  }

  private async submitToProvider(payout: Payout) {
    const result = await this.payoutProvider.submit(payout);

    if (result.status === 'PROCESSING') {
      return this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.PROCESSING,
          providerRef: result.providerRef,
        },
      });
    }

    if (result.status === 'COMPLETED') {
      return this.completePayout(payout.id, result.providerRef);
    }

    return this.failPayout(payout.id, result.failureReason);
  }

  // --- Locking helpers (consistent User -> Wallet -> Campaign order) ---

  private async lockUser(tx: Prisma.TransactionClient, userId: string) {
    const [user] = await tx.$queryRaw<LockedWalletRow[]>`
      SELECT balance_usd FROM "User" WHERE id = ${userId} FOR UPDATE
    `;

    if (!user) {
      throw new NotFoundException('Wallet owner not found');
    }

    return user;
  }

  private async lockOrCreateWallet(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<Wallet> {
    await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const [wallet] = await tx.$queryRaw<
      (LockedWalletTableRow & { userId: string })[]
    >`
      SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
    `;

    return wallet as unknown as Wallet;
  }

  private async lockOwnedCampaign(
    tx: Prisma.TransactionClient,
    advertiserId: string,
    campaignId: string,
  ): Promise<Campaign> {
    const [campaign] = await tx.$queryRaw<LockedCampaignRow[]>`
      SELECT * FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE
    `;

    if (!campaign || campaign.advertiserId !== advertiserId) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign as unknown as Campaign;
  }

  private async lockPayout(tx: Prisma.TransactionClient, payoutId: string) {
    const [payout] = await tx.$queryRaw<Payout[]>`
      SELECT * FROM "Payout" WHERE id = ${payoutId} FOR UPDATE
    `;

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    return payout;
  }

  private async recordTransaction(
    tx: Prisma.TransactionClient,
    data: {
      walletId: string;
      userId: string;
      type: TransactionType;
      amount: Prisma.Decimal;
      referenceId?: string;
      description?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    try {
      return await tx.walletTransaction.create({
        data: {
          walletId: data.walletId,
          userId: data.userId,
          type: data.type,
          amount: data.amount,
          referenceId: data.referenceId,
          description: data.description,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('DUPLICATE_TRANSACTION');
      }

      throw error;
    }
  }

  // --- Misc helpers ---

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, balance_usd: true },
    });

    if (!user) {
      throw new NotFoundException('Wallet owner not found');
    }

    return user;
  }

  private async getOrCreateWallet(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private shapeWallet(
    role: string,
    availableBalance: Prisma.Decimal | number | string,
    wallet: Wallet,
  ) {
    const available = new Prisma.Decimal(availableBalance);
    const reserved = new Prisma.Decimal(wallet.reservedBalance);
    const pending = new Prisma.Decimal(wallet.pendingEarnings);

    const base = {
      walletId: wallet.id,
      currency: wallet.currency,
      availableBalance: available,
      reservedBalance: reserved,
      totalDeposited: wallet.totalDeposited,
      totalSpent: wallet.totalSpent,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      pendingEarnings: pending,
      updatedAt: wallet.updatedAt,
    };

    if (role === 'PUBLISHER') {
      return {
        ...base,
        availableEarnings: available,
        currentEarnings: available.plus(pending),
      };
    }

    // ADVERTISER (and ADMIN, which just gets the raw numbers)
    return {
      ...base,
      currentBalance: available.plus(reserved),
    };
  }

  private normalizeAmount(amountUsd: WalletAmount) {
    const amount = new Prisma.Decimal(amountUsd);

    if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
      throw new ConflictException('Wallet amount must be greater than zero');
    }

    // Guards against float-precision garbage like 10.005000000000001 - every
    // amount that reaches the ledger is money and must round-trip exactly
    // through Decimal(12,2).
    if (!amount.equals(amount.toDecimalPlaces(2))) {
      throw new BadRequestException(
        'Amount cannot have more than 2 decimal places',
      );
    }

    return amount;
  }

  private parseTransactionTypeFilter(type?: string) {
    if (!type) {
      return undefined;
    }

    if (!Object.values(TransactionType).includes(type as TransactionType)) {
      throw new BadRequestException('Invalid transaction type filter');
    }

    return type as TransactionType;
  }

  private parsePayoutStatusFilter(status?: string) {
    if (!status) {
      return undefined;
    }

    if (!Object.values(PayoutStatus).includes(status as PayoutStatus)) {
      throw new BadRequestException('Invalid payout status filter');
    }

    return status as PayoutStatus;
  }
}
