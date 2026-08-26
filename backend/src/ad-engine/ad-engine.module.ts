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
import { CpmBillingService } from './cpm-billing.service';
import { ConversionTrackingService } from './conversion-tracking.service';
import {
  VISITOR_FREQUENCY_CAP_STORE,
  VisitorFrequencyCapService,
} from './visitor-frequency-cap.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [WalletModule, PlatformSettingsModule],
  controllers: [AdEngineController],
  providers: [
    AdBillingService,
    AdEventProducerService,
    AdTargetingService,
    CampaignCacheSyncService,
    ClickHouseAnalyticsEventStore,
    ClickHouseClickIngestionWorkerService,
    ClickHouseIngestionWorkerService,
    ConversionTrackingService,
    CpmBillingService,
    DeviceDetectorService,
    FrequencyCappingService,
    FraudDetectionService,
    GeoIpService,
    RedisCampaignCacheStore,
    RedisStreamMessageBrokerConsumer,
    RedisStreamMessageBrokerPublisher,
    RedisVelocityCounterStore,
    SiteAutoVerificationService,
    VisitorFrequencyCapService,
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
    {
      // Same Redis-backed store as VELOCITY_COUNTER_STORE above, just typed
      // through the richer FrequencyCapCounterStore interface (adds `get`)
      // that per-visitor capping needs to peek a counter without bumping it.
      provide: VISITOR_FREQUENCY_CAP_STORE,
      useExisting: RedisVelocityCounterStore,
    },
  ],
})
export class AdEngineModule {}
