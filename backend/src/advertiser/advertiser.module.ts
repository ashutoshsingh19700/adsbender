import { Module } from '@nestjs/common';

import { AdvertiserController } from './advertiser.controller';
import { AdvertiserService } from './advertiser.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AnalyticsModule, WalletModule],
  controllers: [AdvertiserController],
  providers: [AdvertiserService],
})
export class AdvertiserModule {}
