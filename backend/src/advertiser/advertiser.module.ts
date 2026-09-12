import { Module } from '@nestjs/common';

import { AdvertiserController } from './advertiser.controller';
import { AdvertiserService } from './advertiser.service';
import { CreativeUploadService } from './creative-upload.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WalletModule } from '../wallet/wallet.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [AnalyticsModule, WalletModule, PlatformSettingsModule],
  controllers: [AdvertiserController],
  providers: [AdvertiserService, CreativeUploadService],
})
export class AdvertiserModule {}
