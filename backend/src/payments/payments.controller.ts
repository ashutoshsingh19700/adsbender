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

import type { AuthenticatedRequest } from '../common/authenticated-request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { CapturePaymentDto } from './dto/capture-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from './payments.service';
import { PayPalService } from './paypal.service';

@Controller('api/v1/payments/paypal')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paypal: PayPalService,
  ) {}

  @Post('order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVERTISER')
  createOrder(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.paymentsService.createTopupOrder(req.user.id, dto.amountUsd);
  }

  @Post('capture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVERTISER')
  capture(@Req() req: AuthenticatedRequest, @Body() dto: CapturePaymentDto) {
    return this.paymentsService.confirmPayment(req.user.id, dto.paypalOrderId);
  }

  // Called by PayPal's servers, never the browser - no session cookie, no
  // JWT, deliberately no @UseGuards here. Unlike Razorpay's local HMAC
  // check, PayPal verification is a round trip to PayPal's own API using
  // the paypal-transmission-* headers plus the parsed body - see
  // PayPalService.verifyWebhookSignature. That call is the entire
  // authentication for this route and fails closed (missing webhook id,
  // missing/malformed headers, or a "FAILURE" verdict all reject).
  // Not throttled: PayPal's webhook senders are shared infrastructure behind
  // a small set of IPs, and a durable payment confirmation must never be
  // dropped by a per-IP rate limit meant for abusive clients.
  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle()
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { event_type: string; resource?: unknown },
  ) {
    const verified = await this.paypal.verifyWebhookSignature(headers, body);
    if (!verified) {
      this.logger.warn('Rejected PayPal webhook with invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    await this.paymentsService.handleWebhookEvent(
      body as Parameters<PaymentsService['handleWebhookEvent']>[0],
    );

    return { received: true };
  }
}
