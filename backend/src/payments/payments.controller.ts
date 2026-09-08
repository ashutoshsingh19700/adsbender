import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import type { AuthenticatedRequest } from '../common/authenticated-request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

// Express request augmented with the raw body Buffer main.ts's json()
// verify callback stashes on every request - needed here because HMAC
// webhook verification must run over the exact bytes Razorpay sent, not a
// re-serialization of the parsed JSON (whitespace/key-order differences
// would break the signature).
type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller('api/v1/payments/razorpay')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly razorpay: RazorpayService,
  ) {}

  @Post('order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVERTISER')
  createOrder(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.paymentsService.createTopupOrder(
      req.user.id,
      dto.amountUsd,
      dto.payCurrency,
    );
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVERTISER')
  verify(@Req() req: AuthenticatedRequest, @Body() dto: VerifyPaymentDto) {
    return this.paymentsService.confirmPayment(
      req.user.id,
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
  }

  // Called by Razorpay's servers, never the browser - no session cookie, no
  // JWT, deliberately no @UseGuards here. The X-Razorpay-Signature check
  // below is the entire authentication for this route, and it fails closed
  // (missing secret, missing/malformed header, or a mismatch all reject).
  // Not throttled: Razorpay's webhook senders are shared infrastructure
  // behind a small set of IPs, and a durable payment confirmation must
  // never be dropped by a per-IP rate limit meant for abusive clients.
  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle()
  async handleWebhook(
    @Req() req: RequestWithRawBody,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: { event: string; payload?: unknown },
  ) {
    if (!req.rawBody) {
      // Should be unreachable (main.ts always captures it) - fail closed
      // rather than verify against a re-encoded body that could differ
      // from what was actually signed.
      throw new BadRequestException('Missing request body');
    }

    if (!this.razorpay.verifyWebhookSignature(req.rawBody, signature)) {
      this.logger.warn('Rejected Razorpay webhook with invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    await this.paymentsService.handleWebhookEvent(
      body as Parameters<PaymentsService['handleWebhookEvent']>[0],
    );

    return { received: true };
  }
}
