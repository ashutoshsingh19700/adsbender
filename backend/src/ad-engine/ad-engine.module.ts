import { Module } from '@nestjs/common';

import { WalletModule } from '../wallet/wallet.module';
import { AdBillingService } from './ad-billing.service';
import { AdEngineController } from './ad-engine.controller';
import {
  AdEventProducerService,
  MESSAGE_BROKER_PUBLISHER,
} from './ad-event-producer.service';
import { AdTargetingService } from './ad-targeting.service';
import { ClickHouseAnalyticsEventStore } from './clickhouse-analytics-event.store';
import { ClickHouseClickIngestionWorkerService } from './clickhouse-click-ingestion-worker.service';
import {
  ANALYTICS_EVENT_STORE,
  ClickHouseIngestionWorkerService,
  MESSAGE_BROKER_CONSUMER,
} from './clickhouse-ingestion-worker.service';
import {
  CAMPAIGN_CACHE_STORE,
  CampaignCacheSyncService,
} from './campaign-cache-sync.service';
import { DeviceDetectorService } from './device-detector.service';
import {
  FrequencyCappingService,
  VELOCITY_COUNTER_STORE,
} from './frequency-capping.service';
import { FraudDetectionService } from './fraud-detection.service';
import { GeoIpService } from './geo-ip.service';
import { RedisCampaignCacheStore } from './redis-campaign-cache.store';
import { RedisStreamMessageBrokerConsumer } from './redis-stream-message-broker.consumer';
import { RedisStreamMessageBrokerPublisher } from './redis-stream-message-broker.publisher';
import { RedisVelocityCounterStore } from './redis-velocity-counter.store';
import { SiteAutoVerificationService } from './site-auto-verification.service';

@Module({
  imports: [WalletModule],
  controllers: [AdEngineController],
  providers: [
    AdBillingService,
    AdEventProducerService,
    AdTargetingService,
    CampaignCacheSyncService,
    ClickHouseAnalyticsEventStore,
    ClickHouseClickIngestionWorkerService,
    ClickHouseIngestionWorkerService,
    DeviceDetectorService,
    FrequencyCappingService,
    FraudDetectionService,
    GeoIpService,
    RedisCampaignCacheStore,
    RedisStreamMessageBrokerConsumer,
    RedisStreamMessageBrokerPublisher,
    RedisVelocityCounterStore,
    SiteAutoVerificationService,
    {
      provide: CAMPAIGN_CACHE_STORE,
      useExisting: RedisCampaignCacheStore,
    },
    {
      provide: MESSAGE_BROKER_PUBLISHER,
      useExisting: RedisStreamMessageBrokerPublisher,
    },
    {
      provide: MESSAGE_BROKER_CONSUMER,
      useExisting: RedisStreamMessageBrokerConsumer,
    },
    {
      provide: ANALYTICS_EVENT_STORE,
      useExisting: ClickHouseAnalyticsEventStore,
    },
    {
      provide: VELOCITY_COUNTER_STORE,
      useExisting: RedisVelocityCounterStore,
    },
  ],
})
export class AdEngineModule {}
