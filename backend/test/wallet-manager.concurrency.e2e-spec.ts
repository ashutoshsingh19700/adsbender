import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';
import { PlatformSettingsService } from '../src/platform-settings/platform-settings.service';
import { WalletManager } from '../src/wallet/wallet-manager.service';

/**
 * Proves the WalletManager's `SELECT ... FOR UPDATE` row lock actually
 * serializes concurrent deductions against a real Postgres connection pool.
 * The unit test in wallet-manager.service.spec.ts only proves the ordering
 * contract against a mocked transaction; this test requires a live database
 * (see docker-compose.yml's `postgres` service) to prove real lock
 * contention rather than a JS-level mutex standing in for one.
 */
describe('WalletManager row-lock concurrency (real Postgres)', () => {
  let prisma: PrismaService;
  let walletManager: WalletManager;
  let userId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    walletManager = new WalletManager(prisma, new PlatformSettingsService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Concurrency Test Advertiser',
        email: `wallet-concurrency-${Date.now()}-${Math.random()}@test.local`,
        password: 'irrelevant-for-this-test',
        role: 'ADVERTISER',
        balance_usd: new Prisma.Decimal('5.00'),
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it('allows exactly 5 of 10 concurrent $1 deductions from a real $5 balance without wallet deficit leakage', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => walletManager.deduct(userId, '1.00')),
    );

    const successful = attempts.filter((a) => a.status === 'fulfilled');
    const failed = attempts.filter((a) => a.status === 'rejected');

    expect(successful).toHaveLength(5);
    expect(failed).toHaveLength(5);
    expect(
      failed.every(
        (attempt) =>
          attempt.status === 'rejected' &&
          attempt.reason instanceof ConflictException,
      ),
    ).toBe(true);

    const finalUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(finalUser.balance_usd.toString()).toBe('0');
  }, 20000);
});
