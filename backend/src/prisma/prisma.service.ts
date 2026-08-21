import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      transactionOptions: {
        // Prisma's 5s default is tuned for same-region latency. The DB
        // (Supabase, ap-south-1) and this server are cross-region, and
        // wallet-manager.service.ts's interactive transactions (budget
        // reservation, deposits, payouts) do several sequential round
        // trips each - comfortably over 5s in practice (observed ~5.2s
        // on a real reservation), which surfaced as "Transaction already
        // closed" 500s. 15s gives real headroom without masking a truly
        // hung transaction.
        timeout: 15_000,
        maxWait: 10_000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
