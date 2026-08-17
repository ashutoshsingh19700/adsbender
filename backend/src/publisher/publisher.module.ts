import { Module } from '@nestjs/common';

import { PublisherController } from './publisher.controller';
import { PublisherService } from './publisher.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [PublisherController],
  providers: [PublisherService],
})
export class PublisherModule {}
