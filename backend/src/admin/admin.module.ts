import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WalletModule } from '../wallet/wallet.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [WalletModule, PlatformSettingsModule, AnalyticsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
