import { Module } from '@nestjs/common';

import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletManager } from './wallet-manager.service';
import { WalletController } from './wallet.controller';
import { BeneficiaryAccountService } from './beneficiary-account.service';
import { RazorpayxPayoutWebhookController } from './razorpayx-payout-webhook.controller';
import { ManualPayoutProvider } from './payout-providers/manual-payout.provider';
import { RazorpayXPayoutProvider } from './payout-providers/razorpayx-payout.provider';
import { PAYOUT_PROVIDER } from './payout-providers/payout-provider.interface';

@Module({
  imports: [PlatformSettingsModule, NotificationsModule],
  controllers: [WalletController, RazorpayxPayoutWebhookController],
  providers: [
    WalletManager,
    BeneficiaryAccountService,
    ManualPayoutProvider,
    RazorpayXPayoutProvider,
    // RazorpayXPayoutProvider only actually moves money once
    // RAZORPAYX_KEY_ID/SECRET/ACCOUNT_NUMBER are set (see its
    // getCredentials) - until then this falls back to ManualPayoutProvider
    // so payouts still queue for a human to confirm instead of every
    // request failing outright.
    {
      provide: PAYOUT_PROVIDER,
      useFactory: (
        razorpayX: RazorpayXPayoutProvider,
        manual: ManualPayoutProvider,
      ) =>
        process.env.RAZORPAYX_KEY_ID &&
        process.env.RAZORPAYX_KEY_SECRET &&
        process.env.RAZORPAYX_ACCOUNT_NUMBER
          ? razorpayX
          : manual,
      inject: [RazorpayXPayoutProvider, ManualPayoutProvider],
    },
  ],
  exports: [WalletManager],
})
export class WalletModule {}
