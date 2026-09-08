import { Module } from '@nestjs/common';

import { WalletModule } from '../wallet/wallet.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [WalletModule, PlatformSettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService],
})
export class PaymentsModule {}
