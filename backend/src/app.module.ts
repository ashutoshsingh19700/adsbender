import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { AdEngineModule } from './ad-engine/ad-engine.module';
import { PublisherModule } from './publisher/publisher.module';
import { AdvertiserModule } from './advertiser/advertiser.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

@Module({
  imports: [
    // Default abuse guard for the normal (cookie/session-authenticated)
    // API - login, campaign/site management, wallet, admin, etc. Deliberately
    // does NOT cover the ad-serving endpoints (/api/v1/serve, /click, /trap,
    // /conversion): those are called at real ad-traffic volume from
    // arbitrary third-party publisher pages by design (see
    // AdEngineController), and are already rate-limited on their own terms
    // by FraudDetectionService/FrequencyCappingService's IP+visitor velocity
    // checks - see the @SkipThrottle() on AdEngineController. A flat
    // per-IP cap there would either be too loose to matter for abuse or,
    // set tight enough to matter, would throttle legitimate high-traffic
    // publisher sites sharing a NAT/proxy IP.
    //
    // Two windows: a short burst cap catches a script hammering an endpoint
    // in a tight loop, a longer sustained cap catches slower distributed
    // abuse that would blow past a single burst window.
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 1_000, limit: 20 },
      { name: 'sustained', ttl: 60_000, limit: 300 },
    ]),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    UsersModule,
    WalletModule,
    AdEngineModule,
    PublisherModule,
    AdvertiserModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
