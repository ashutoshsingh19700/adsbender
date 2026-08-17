import { Global, Module } from '@nestjs/common';

import { SupabaseService } from './supabase.service';

// @Global so AuthModule's guard and any future module can inject
// SupabaseService without every consumer re-importing this module.
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
