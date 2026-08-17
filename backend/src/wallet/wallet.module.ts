import { Module } from '@nestjs/common';

import { WalletManager } from './wallet-manager.service';
import { WalletController } from './wallet.controller';
import { ManualPayoutProvider } from './payout-providers/manual-payout.provider';
import { PAYOUT_PROVIDER } from './payout-providers/payout-provider.interface';

@Module({
  controllers: [WalletController],
  providers: [
    WalletManager,
    // No payout gateway is configured yet - swap this binding for a real
    // Stripe/Razorpay/etc. provider once credentials exist, everything else
    // (WalletManager, the controller, the ledger) stays the same.
    { provide: PAYOUT_PROVIDER, useClass: ManualPayoutProvider },
  ],
  exports: [WalletManager],
})
export class WalletModule {}
