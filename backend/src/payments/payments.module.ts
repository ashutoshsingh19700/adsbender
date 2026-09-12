import { Module } from '@nestjs/common';

import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayPalService } from './paypal.service';
import { RazorpayPaymentsController } from './razorpay-payments.controller';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [WalletModule, PlatformSettingsModule],
  controllers: [PaymentsController, RazorpayPaymentsController],
  providers: [PaymentsService, PayPalService, RazorpayService],
})
export class PaymentsModule {}
