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
import { ClickHouseTrafficIngestionWorkerService } from './clickhouse-traffic-ingestion-worker.service';
import {
  ANALYTICS_EVENT_STORE,
  ClickHouseIngestionWorkerService,
  MESSAGE_BROKER_CONSUMER,
} from './clickhouse-ingestion-worker.service';
import {
  CAMPAIGN_CACHE_STORE,
  CampaignCacheSyncService,
} from './campaign-cache-sync.service';
import {
  BLACKLIST_CACHE_STORE,
  BlacklistCacheSyncService,
} from './blacklist-cache-sync.service';
import { ClickIntegrityService } from './click-integrity.service';
import { DatacenterIpService } from './datacenter-ip.service';
import { DeviceDetectorService } from './device-detector.service';
import {
  FrequencyCappingService,
  VELOCITY_COUNTER_STORE,
} from './frequency-capping.service';
import { FraudDetectionService } from './fraud-detection.service';
import { GeoIpService } from './geo-ip.service';
import { RedisBlacklistCacheStore } from './redis-blacklist-cache.store';
import { RedisCampaignCacheStore } from './redis-campaign-cache.store';
import { RedisImpressionDedupStore } from './redis-impression-dedup.store';
import { RedisStreamMessageBrokerConsumer } from './redis-stream-message-broker.consumer';
import { RedisStreamMessageBrokerPublisher } from './redis-stream-message-broker.publisher';
import { RedisVelocityCounterStore } from './redis-velocity-counter.store';
import { RedisZoneCacheStore } from './redis-zone-cache.store';
import { PublisherImpressionDedupService, PUBLISHER_IMPRESSION_DEDUP_STORE } from './publisher-impression-dedup.service';
import { SiteAutoVerificationService } from './site-auto-verification.service';
import {
  ZONE_CACHE_STORE,
  ZoneCacheSyncService,
} from './zone-cache-sync.service';
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
    BlacklistCacheSyncService,
    CampaignCacheSyncService,
    ClickHouseAnalyticsEventStore,
    ClickHouseClickIngestionWorkerService,
    ClickHouseIngestionWorkerService,
    ClickHouseTrafficIngestionWorkerService,
    ClickIntegrityService,
    ConversionTrackingService,
    CpmBillingService,
    DatacenterIpService,
    DeviceDetectorService,
    FrequencyCappingService,
    FraudDetectionService,
    GeoIpService,
    PublisherImpressionDedupService,
    RedisBlacklistCacheStore,
    RedisCampaignCacheStore,
    RedisImpressionDedupStore,
    RedisStreamMessageBrokerConsumer,
    RedisStreamMessageBrokerPublisher,
    RedisVelocityCounterStore,
    RedisZoneCacheStore,
    SiteAutoVerificationService,
    VisitorFrequencyCapService,
    ZoneCacheSyncService,
    {
      provide: CAMPAIGN_CACHE_STORE,
      useExisting: RedisCampaignCacheStore,
    },
    {
      provide: ZONE_CACHE_STORE,
      useExisting: RedisZoneCacheStore,
    },
    {
      provide: BLACKLIST_CACHE_STORE,
      useExisting: RedisBlacklistCacheStore,
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
    {
      provide: PUBLISHER_IMPRESSION_DEDUP_STORE,
      useExisting: RedisImpressionDedupStore,
    },
  ],
  // ClickIntegrityService is a stateless HMAC signer (no cache/DB
  // dependency) - PublisherModule reuses it to sign the click URL embedded
  // in a Newsletter Sponsorship snippet, the same way AdEngineController
  // signs every other creative's click URL. See PublisherService.getNewsletterSnippet.
  exports: [ClickIntegrityService],
})
export class AdEngineModule {}
