import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../common/authenticated-request';
import { WalletManager } from './wallet-manager.service';
import { AdminDepositDto } from './dto/admin-deposit.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { CompletePayoutDto } from './dto/complete-payout.dto';
import { FailPayoutDto } from './dto/fail-payout.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

// Every request here goes through the same wallet service the rest of the
// app already uses (WalletManager) - this controller is purely a thin,
// validated, role-guarded HTTP surface over it. No balance is ever read
// from or written by anything the client sends.
@Controller('api/v1/wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(private readonly walletManager: WalletManager) {}

  @Get()
  getWallet(@Req() req: AuthenticatedRequest) {
    return this.walletManager.getWallet(req.user.id);
  }

  @Get('summary')
  getSummary(@Req() req: AuthenticatedRequest) {
    return this.walletManager.getSummary(req.user.id);
  }

  @Get('transactions')
  listTransactions(
    @Req() req: AuthenticatedRequest,
    @Query() query: { page?: string; pageSize?: string; type?: string },
  ) {
    return this.walletManager.listTransactions(req.user.id, query);
  }

  // ADMIN-only manual credit (e.g. reconciling a bank transfer, a goodwill
  // adjustment) - this used to be reachable by any ADVERTISER with a
  // client-supplied amount and no payment behind it whatsoever, i.e. free
  // money. Real advertiser top-ups now go through
  // PaymentsController (POST /api/v1/payments/paypal/order + webhook),
  // which only ever credits an amount fixed server-side at order creation
  // and only after PayPal confirms the payment.
  @Post('admin/deposit')
  @Roles('ADMIN')
  adminDeposit(@Body() dto: AdminDepositDto) {
    return this.walletManager.deposit(dto.userId, dto.amount, {
      referenceId: dto.idempotencyKey,
      description: dto.reason,
    });
  }

  @Post('payout')
  @Roles('PUBLISHER')
  requestPayout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.walletManager.requestPayout(req.user.id, dto.amount, {
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Get('payouts')
  @Roles('PUBLISHER')
  listPayouts(
    @Req() req: AuthenticatedRequest,
    @Query() query: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.walletManager.listPayouts(req.user.id, query);
  }

  @Get('payout/:id')
  @Roles('PUBLISHER', 'ADMIN')
  getPayout(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const role = (req.user as { role?: string }).role;

    return this.walletManager.getPayout(req.user.id, id, role === 'ADMIN');
  }

  // --- Ops/admin: payout lifecycle (no payment gateway is configured, see
  // payout-providers/ - a human confirms these until one is wired up) ---

  @Get('admin/payouts')
  @Roles('ADMIN')
  adminListPayouts(
    @Query() query: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.walletManager.adminListPayouts(query);
  }

  @Patch('admin/payouts/:id/complete')
  @Roles('ADMIN')
  completePayout(@Param('id') id: string, @Body() dto: CompletePayoutDto) {
    return this.walletManager.completePayout(id, dto.providerRef);
  }

  @Patch('admin/payouts/:id/fail')
  @Roles('ADMIN')
  failPayout(@Param('id') id: string, @Body() dto: FailPayoutDto) {
    return this.walletManager.failPayout(id, dto.reason);
  }
}
