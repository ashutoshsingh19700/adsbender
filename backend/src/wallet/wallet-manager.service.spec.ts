import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletManager } from './wallet-manager.service';

class Mutex {
  private current = Promise.resolve();

  async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.current;
    let release: () => void;
    this.current = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await work();
    } finally {
      release!();
    }
  }
}

describe('WalletManager', () => {
  let walletManager: WalletManager;
  let prismaService: {
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletManager,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          // Every existing test here reserves/spends against a fresh mocked
          // wallet with no real minimum-balance floor to worry about, so a
          // permissive stub (floor of $0) keeps them all behaving exactly as
          // before this dependency was added.
          provide: PlatformSettingsService,
          useValue: {
            getMinAdvertiserBalanceUsd: jest.fn().mockResolvedValue(new Prisma.Decimal(0)),
          },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    walletManager = module.get(WalletManager);
  });

  it('deducts from a wallet inside a row-locked transaction', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          balance_usd: new Prisma.Decimal('5.00'),
        },
      ]),
      user: {
        update: jest.fn().mockResolvedValue({
          id: 'user-1',
          balance_usd: new Prisma.Decimal('4.00'),
        }),
      },
    };

    prismaService.$transaction.mockImplementation((callback) => callback(tx));

    const result = await walletManager.deduct('user-1', '1.00');

    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join(' ')).toContain('FOR UPDATE');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        balance_usd: {
          decrement: new Prisma.Decimal('1.00'),
        },
      },
      select: {
        id: true,
        balance_usd: true,
      },
    });
    expect(result.balance_usd.toString()).toBe('4');
  });

  it('credits a wallet inside a row-locked transaction', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          balance_usd: new Prisma.Decimal('4.00'),
        },
      ]),
      user: {
        update: jest.fn().mockResolvedValue({
          id: 'user-1',
          balance_usd: new Prisma.Decimal('5.00'),
        }),
      },
    };

    prismaService.$transaction.mockImplementation((callback) => callback(tx));

    const result = await walletManager.credit('user-1', '1.00');

    expect(tx.$queryRaw.mock.calls[0][0].join(' ')).toContain('FOR UPDATE');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        balance_usd: {
          increment: new Prisma.Decimal('1.00'),
        },
      },
      select: {
        id: true,
        balance_usd: true,
      },
    });
    expect(result.balance_usd.toString()).toBe('5');
  });

  it('fails cleanly when a wallet does not exist', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        update: jest.fn(),
      },
    };

    prismaService.$transaction.mockImplementation((callback) => callback(tx));

    await expect(walletManager.deduct('missing-user', '1.00')).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('allows exactly 5 of 10 concurrent $1 deductions from a $5 balance', async () => {
    const mutex = new Mutex();
    let balance = new Prisma.Decimal('5.00');

    prismaService.$transaction.mockImplementation((callback) =>
      mutex.runExclusive(() => {
        const tx = {
          $queryRaw: jest.fn().mockImplementation(() =>
            Promise.resolve([
              {
                balance_usd: balance,
              },
            ]),
          ),
          user: {
            update: jest.fn().mockImplementation(({ data }) => {
              balance = balance.minus(data.balance_usd.decrement);

              return Promise.resolve({
                id: 'user-1',
                balance_usd: balance,
              });
            }),
          },
        };

        return callback(tx);
      }),
    );

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => walletManager.deduct('user-1', '1.00')),
    );

    const successfulAttempts = attempts.filter(
      (attempt) => attempt.status === 'fulfilled',
    );
    const failedAttempts = attempts.filter(
      (attempt) => attempt.status === 'rejected',
    );

    expect(successfulAttempts).toHaveLength(5);
    expect(failedAttempts).toHaveLength(5);
    expect(
      failedAttempts.every(
        (attempt) =>
          attempt.status === 'rejected' &&
          attempt.reason instanceof ConflictException,
      ),
    ).toBe(true);
    expect(balance.toString()).toBe('0');
  });
});
