import { Module } from '@nestjs/common';

import { PublisherController } from './publisher.controller';
import { PublisherService } from './publisher.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AdEngineModule } from '../ad-engine/ad-engine.module';

@Module({
  imports: [AnalyticsModule, AdEngineModule],
  controllers: [PublisherController],
  providers: [PublisherService],
})
export class PublisherModule {}
