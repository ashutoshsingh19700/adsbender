import { Global, Module } from '@nestjs/common';
import { UsersService } from './users.service';

// @Global because JwtAuthGuard (see auth/guards/jwt-auth.guard.ts) depends
// on UsersService and is applied via @UseGuards(JwtAuthGuard) across
// several feature modules (publisher, advertiser, wallet, admin,
// analytics) - without this, each of those would need to import
// UsersModule itself just to satisfy the guard's DI.
@Global()
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
