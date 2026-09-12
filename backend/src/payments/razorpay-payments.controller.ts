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
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

@Controller('api/v1/payments/razorpay')
export class RazorpayPaymentsController {
  private readonly logger = new Logger(RazorpayPaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly razorpay: RazorpayService,
  ) {}

  @Post('order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVERTISER')
  createOrder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRazorpayOrderDto,
  ) {
    return this.paymentsService.createRazorpayOrder(
      req.user.id,
      dto.amountUsd,
      dto.payCurrency,
    );
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVERTISER')
  verify(@Req() req: AuthenticatedRequest, @Body() dto: VerifyRazorpayPaymentDto) {
    return this.paymentsService.confirmRazorpayPayment(
      req.user.id,
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
  }

  // Called by Razorpay's servers, never the browser - no session cookie, no
  // JWT, deliberately no @UseGuards here. The `X-Razorpay-Signature` header,
  // HMAC-verified against the RAW request body (captured in main.ts's
  // json() verify callback) using the webhook secret, is the entire
  // authentication for this route and fails closed (missing secret, missing
  // signature, or a mismatch all reject).
  // Not throttled: Razorpay's webhook senders are shared infrastructure
  // behind a small set of IPs, and a durable payment confirmation must
  // never be dropped by a per-IP rate limit meant for abusive clients.
  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle()
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: { event: string; payload?: unknown },
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }

    const verified = this.razorpay.verifyWebhookSignature(
      req.rawBody,
      signature,
    );
    if (!verified) {
      this.logger.warn('Rejected Razorpay webhook with invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    await this.paymentsService.handleRazorpayWebhookEvent(
      body as Parameters<PaymentsService['handleRazorpayWebhookEvent']>[0],
    );

    return { received: true };
  }
}
