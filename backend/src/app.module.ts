import { Module } from '@nestjs/common';
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

@Module({
  imports: [
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
  providers: [AppService],
})
export class AppModule {}
