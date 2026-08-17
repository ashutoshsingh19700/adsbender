import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';
import { WalletManager } from '../src/wallet/wallet-manager.service';

/**
 * Wallet/billing subsystem behaviour proven against a real Postgres
 * connection (see docker-compose.yml's `postgres` service) - row locks,
 * unique-constraint-based idempotency, and rollback-on-failure only mean
 * something when they're exercised against the real database engine rather
 * than a mocked transaction client.
 */
describe('Wallet/billing subsystem (real Postgres)', () => {
  let prisma: PrismaService;
  let walletManager: WalletManager;

  let advertiserId: string;
  let otherAdvertiserId: string;
  let publisherId: string;
  let campaignId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    walletManager = new WalletManager(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random()}`;

    const advertiser = await prisma.user.create({
      data: {
        name: 'Billing Test Advertiser',
        email: `wallet-billing-adv-${suffix}@test.local`,
        password: 'irrelevant',
        role: 'ADVERTISER',
        balance_usd: new Prisma.Decimal('100.00'),
      },
    });
    advertiserId = advertiser.id;

    const otherAdvertiser = await prisma.user.create({
      data: {
        name: 'Other Advertiser',
        email: `wallet-billing-other-${suffix}@test.local`,
        password: 'irrelevant',
        role: 'ADVERTISER',
        balance_usd: new Prisma.Decimal('50.00'),
      },
    });
    otherAdvertiserId = otherAdvertiser.id;

    const publisher = await prisma.user.create({
      data: {
        name: 'Billing Test Publisher',
        email: `wallet-billing-pub-${suffix}@test.local`,
        password: 'irrelevant',
        role: 'PUBLISHER',
        balance_usd: new Prisma.Decimal('30.00'),
      },
    });
    publisherId = publisher.id;

    const campaign = await prisma.campaign.create({
      data: {
        advertiserId,
        campaignName: 'Billing test campaign',
        totalBudget: new Prisma.Decimal('80.00'),
        dailyBudget: new Prisma.Decimal('80.00'),
        maxCpc: new Prisma.Decimal('1.00'),
        targetCountries: ['US'],
        targetDevices: ['desktop'],
        status: CampaignStatus.ACTIVE,
      },
    });
    campaignId = campaign.id;
  });

  afterEach(async () => {
    await prisma.walletTransaction.deleteMany({
      where: { userId: { in: [advertiserId, otherAdvertiserId, publisherId] } },
    });
    await prisma.payout.deleteMany({
      where: { userId: { in: [advertiserId, otherAdvertiserId, publisherId] } },
    });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.wallet.deleteMany({
      where: { userId: { in: [advertiserId, otherAdvertiserId, publisherId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [advertiserId, otherAdvertiserId, publisherId] } },
    });
  });

  it('rejects a campaign reservation that exceeds available balance', async () => {
    await expect(
      walletManager.reserveCampaignBudget(advertiserId, campaignId, '500.00'),
    ).rejects.toThrow(ConflictException);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: advertiserId },
    });
    expect(user.balance_usd.toFixed(2)).toBe('100.00');
  });

  it('rejects a duplicate ad-spend transaction for the same reference id', async () => {
    await walletManager.reserveCampaignBudget(advertiserId, campaignId, '40.00');

    await walletManager.recordCampaignSpend(
      campaignId,
      '10.00',
      'click-1',
      'first delivery',
    );

    await expect(
      walletManager.recordCampaignSpend(
        campaignId,
        '10.00',
        'click-1',
        'retried delivery',
      ),
    ).rejects.toThrow(ConflictException);

    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });
    // Only the first spend should have applied - no double charge.
    expect(campaign.spentAmount.toFixed(2)).toBe('10.00');
    expect(campaign.reservedAmount.toFixed(2)).toBe('30.00');
  });

  it('serializes concurrent ad-spend against the same reserved budget without overspending', async () => {
    await walletManager.reserveCampaignBudget(advertiserId, campaignId, '10.00');

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        walletManager.recordCampaignSpend(campaignId, '2.00', `click-${i}`),
      ),
    );

    const successful = attempts.filter((a) => a.status === 'fulfilled');
    expect(successful).toHaveLength(5);

    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });
    expect(campaign.spentAmount.toFixed(2)).toBe('10.00');
    expect(campaign.reservedAmount.toFixed(2)).toBe('0.00');
  }, 20000);

  it('refunds a released campaign reservation back to available balance', async () => {
    await walletManager.reserveCampaignBudget(advertiserId, campaignId, '40.00');
    await walletManager.releaseCampaignReservation(
      advertiserId,
      campaignId,
      '15.00',
      'Budget lowered',
    );

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: advertiserId },
    });
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });

    expect(user.balance_usd.toFixed(2)).toBe('75.00');
    expect(campaign.reservedAmount.toFixed(2)).toBe('25.00');
  });

  it('rejects a payout request above the available balance', async () => {
    await expect(
      walletManager.requestPayout(publisherId, '1000.00'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a payout request below the minimum threshold', async () => {
    await expect(
      walletManager.requestPayout(publisherId, '1.00'),
    ).rejects.toThrow(BadRequestException);
  });

  it('holds funds on payout request and returns them if the payout fails', async () => {
    const payout = await walletManager.requestPayout(publisherId, '20.00');

    let user = await prisma.user.findUniqueOrThrow({
      where: { id: publisherId },
    });
    expect(user.balance_usd.toFixed(2)).toBe('10.00');

    await walletManager.failPayout(payout.id, 'Bank rejected transfer');

    user = await prisma.user.findUniqueOrThrow({ where: { id: publisherId } });
    expect(user.balance_usd.toFixed(2)).toBe('30.00');

    const failed = await prisma.payout.findUniqueOrThrow({
      where: { id: payout.id },
    });
    expect(failed.status).toBe('FAILED');
  });

  it('completes a payout and updates lifetime withdrawn totals', async () => {
    const payout = await walletManager.requestPayout(publisherId, '20.00');
    await walletManager.completePayout(payout.id, 'manual-ref-123');

    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: publisherId },
    });
    expect(wallet.totalWithdrawn.toFixed(2)).toBe('20.00');
    expect(wallet.reservedBalance.toFixed(2)).toBe('0.00');
  });

  it('rejects operating on a campaign owned by a different advertiser', async () => {
    await expect(
      walletManager.reserveCampaignBudget(
        otherAdvertiserId,
        campaignId,
        '10.00',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects reading a payout that belongs to a different user', async () => {
    const payout = await walletManager.requestPayout(publisherId, '20.00');

    await expect(
      walletManager.getPayout(otherAdvertiserId, payout.id),
    ).rejects.toThrow(NotFoundException);

    // The owner can still read it, and an admin can read anyone's.
    await expect(
      walletManager.getPayout(publisherId, payout.id),
    ).resolves.toMatchObject({ id: payout.id });
    await expect(
      walletManager.getPayout(otherAdvertiserId, payout.id, true),
    ).resolves.toMatchObject({ id: payout.id });
  });

  it('rolls back the whole spend when the campaign is not active', async () => {
    await walletManager.reserveCampaignBudget(advertiserId, campaignId, '40.00');
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.PAUSED },
    });

    await expect(
      walletManager.recordCampaignSpend(campaignId, '5.00', 'click-paused'),
    ).rejects.toThrow(ConflictException);

    // Nothing should have moved: no ledger row, reserved amount untouched.
    const transactions = await prisma.walletTransaction.findMany({
      where: { referenceId: 'click-paused' },
    });
    expect(transactions).toHaveLength(0);

    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });
    expect(campaign.reservedAmount.toFixed(2)).toBe('40.00');
  });
});
