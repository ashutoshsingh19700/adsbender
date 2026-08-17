import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller';
import { ANALYTICS_QUERY_STORE, AnalyticsService } from './analytics.service';
import { ClickHouseAnalyticsQueryStore } from './clickhouse-analytics-query.store';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ClickHouseAnalyticsQueryStore,
    {
      provide: ANALYTICS_QUERY_STORE,
      useExisting: ClickHouseAnalyticsQueryStore,
    },
  ],
  // Publisher/advertiser modules reuse this service for zone/campaign
  // performance instead of duplicating ClickHouse query logic.
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
