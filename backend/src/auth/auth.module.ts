import { Global, Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles/roles.guard';

// @Global so JwtAuthGuard/RolesGuard resolve via @UseGuards(...) in every
// feature module's controllers (publisher, advertiser, wallet, admin,
// analytics) without each of them importing AuthModule directly - those
// guards now carry real constructor dependencies (Supabase/Users), unlike
// the old passport-jwt strategy which had none.
@Global()
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
