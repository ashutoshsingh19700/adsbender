import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import type { BlacklistCacheStore } from './blacklist-cache.types';
import { PrismaService } from '../prisma/prisma.service';

export const BLACKLIST_CACHE_STORE = Symbol('BLACKLIST_CACHE_STORE');
export const BLACKLIST_CACHE_SYNC_INTERVAL_MS = 30_000;

// Mirrors CampaignCacheSyncService/ZoneCacheSyncService's sync-on-boot-
// then-poll shape - see CampaignCacheSyncService for the fuller reasoning.
// A newly-blacklisted IP (including one FraudDetectionService.
// recordHoneypotHit just wrote straight to Postgres) can take up to
// BLACKLIST_CACHE_SYNC_INTERVAL_MS to start actually being blocked - the
// same staleness budget already accepted for campaigns/zones, traded for
// removing a Postgres round trip from literally every /serve and /click
// request.
@Injectable()
export class BlacklistCacheSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlacklistCacheSyncService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BLACKLIST_CACHE_STORE)
    private readonly blacklistCacheStore: BlacklistCacheStore,
  ) {}

  onModuleInit() {
    if (process.env.BLACKLIST_CACHE_SYNC_ENABLED === 'false') {
      return;
    }

    void this.runSyncSafely();
    this.interval = setInterval(
      () => void this.runSyncSafely(),
      BLACKLIST_CACHE_SYNC_INTERVAL_MS,
    );
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async runSyncSafely() {
    try {
      await this.syncBlacklistedIps();
    } catch (error) {
      this.logger.error('Blacklist cache sync failed', error);
    }
  }

  async syncBlacklistedIps() {
    const entries = await this.prisma.blacklistedIp.findMany({
      select: { ipAddress: true },
    });
    const ipAddresses = entries.map((entry) => entry.ipAddress);

    await this.blacklistCacheStore.replaceBlacklistedIps(ipAddresses);

    return {
      cachedIps: ipAddresses.length,
    };
  }
}
