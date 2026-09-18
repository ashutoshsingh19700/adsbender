import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import type { ZoneCacheStore } from './zone-cache.types';
import { PrismaService } from '../prisma/prisma.service';
import { isSingletonWorker } from '../common/cluster-worker';

export const ZONE_CACHE_STORE = Symbol('ZONE_CACHE_STORE');
export const ZONE_CACHE_SYNC_INTERVAL_MS = 30_000;

// Mirrors CampaignCacheSyncService's own pattern (same interval, same
// sync-on-boot-then-poll shape) - see that file for the fuller reasoning.
// Kept as its own service/cache rather than folded into the campaign one
// since zones and campaigns are unrelated tables with unrelated write
// paths (PublisherController vs AdvertiserController/AdminController); one
// query failing (e.g. a schema hiccup on one table) shouldn't take the
// other's cache down with it.
@Injectable()
export class ZoneCacheSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZoneCacheSyncService.name);
  private interval?: NodeJS.Timeout;
  // See CampaignCacheSyncService.lastSyncedSnapshot - skips the Redis write
  // entirely on a tick where nothing changed, instead of billing a command
  // for it every 30s regardless.
  private lastSyncedSnapshot?: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ZONE_CACHE_STORE)
    private readonly zoneCacheStore: ZoneCacheStore,
  ) {}

  onModuleInit() {
    if (
      process.env.ZONE_CACHE_SYNC_ENABLED === 'false' ||
      !isSingletonWorker()
    ) {
      return;
    }

    void this.runSyncSafely();
    this.interval = setInterval(
      () => void this.runSyncSafely(),
      ZONE_CACHE_SYNC_INTERVAL_MS,
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
      await this.syncActiveZones();
    } catch (error) {
      // Same reasoning as CampaignCacheSyncService: never let a sync
      // failure (Redis unreachable, a transient DB error) crash the
      // process via an unhandled rejection from the setInterval callback.
      this.logger.error('Zone cache sync failed', error);
    }
  }

  async syncActiveZones() {
    const zones = await this.prisma.adZone.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        layoutType: true,
        publisherId: true,
        siteId: true,
        allowedCategories: true,
      },
    });
    const snapshot = JSON.stringify(
      [...zones].sort((a, b) => a.id.localeCompare(b.id)),
    );

    if (snapshot !== this.lastSyncedSnapshot) {
      await this.zoneCacheStore.replaceActiveZoneIds(zones);
      this.lastSyncedSnapshot = snapshot;
    }

    return {
      cachedZones: zones.length,
    };
  }
}
