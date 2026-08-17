import { Test, TestingModule } from '@nestjs/testing';

import { WalletController } from './wallet.controller';
import { WalletManager } from './wallet-manager.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

describe('WalletController', () => {
  let controller: WalletController;
  const walletManager = {
    getWallet: jest.fn(),
    getSummary: jest.fn(),
    listTransactions: jest.fn(),
    deposit: jest.fn(),
    requestPayout: jest.fn(),
    listPayouts: jest.fn(),
    getPayout: jest.fn(),
    completePayout: jest.fn(),
    failPayout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Tests call controller methods directly rather than through HTTP, so
    // the guards never actually run - these stubs exist only so Nest can
    // resolve @UseGuards(JwtAuthGuard, RolesGuard) at module-compile time
    // without needing a real SupabaseService/UsersService/DB connection.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletManager, useValue: walletManager }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(WalletController);
  });

  it('fetches the wallet for the authenticated user', async () => {
    walletManager.getWallet.mockResolvedValue({ availableBalance: '10.00' });

    await controller.getWallet({ user: { id: 'user-1' } });

    expect(walletManager.getWallet).toHaveBeenCalledWith('user-1');
  });

  it('passes deposit amount and idempotency key through', async () => {
    walletManager.deposit.mockResolvedValue({ message: 'Deposit successful' });

    await controller.deposit(
      { user: { id: 'advertiser-1' } },
      { amount: 50, idempotencyKey: 'key-1' },
    );

    expect(walletManager.deposit).toHaveBeenCalledWith('advertiser-1', 50, {
      referenceId: 'key-1',
    });
  });

  it('passes payout amount and idempotency key through', async () => {
    walletManager.requestPayout.mockResolvedValue({ id: 'payout-1' });

    await controller.requestPayout(
      { user: { id: 'publisher-1' } },
      { amount: 25, idempotencyKey: 'key-2' },
    );

    expect(walletManager.requestPayout).toHaveBeenCalledWith(
      'publisher-1',
      25,
      { idempotencyKey: 'key-2' },
    );
  });

  it('treats a non-admin caller as a non-admin ownership check', async () => {
    walletManager.getPayout.mockResolvedValue({ id: 'payout-1' });

    await controller.getPayout(
      { user: { id: 'publisher-1', role: 'PUBLISHER' } } as never,
      'payout-1',
    );

    expect(walletManager.getPayout).toHaveBeenCalledWith(
      'publisher-1',
      'payout-1',
      false,
    );
  });

  it('lets an admin caller bypass the ownership check', async () => {
    walletManager.getPayout.mockResolvedValue({ id: 'payout-1' });

    await controller.getPayout(
      { user: { id: 'admin-1', role: 'ADMIN' } } as never,
      'payout-1',
    );

    expect(walletManager.getPayout).toHaveBeenCalledWith(
      'admin-1',
      'payout-1',
      true,
    );
  });

  it('forwards admin payout completion with the provider reference', async () => {
    walletManager.completePayout.mockResolvedValue({ id: 'payout-1' });

    await controller.completePayout('payout-1', { providerRef: 'ref-123' });

    expect(walletManager.completePayout).toHaveBeenCalledWith(
      'payout-1',
      'ref-123',
    );
  });

  it('forwards admin payout failure with the reason', async () => {
    walletManager.failPayout.mockResolvedValue({ id: 'payout-1' });

    await controller.failPayout('payout-1', { reason: 'Bank declined' });

    expect(walletManager.failPayout).toHaveBeenCalledWith(
      'payout-1',
      'Bank declined',
    );
  });
});
