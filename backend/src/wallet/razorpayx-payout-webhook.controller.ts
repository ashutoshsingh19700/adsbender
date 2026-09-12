import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

import { WalletManager } from './wallet-manager.service';

// Called by RazorpayX's servers, never the browser - no session cookie, no
// JWT, deliberately no auth guard here. The `X-Razorpay-Signature` header,
// HMAC-verified against the RAW request body (captured in main.ts's json()
// verify callback) using a separate webhook secret (Dashboard > Webhooks,
// NOT the API key secret), is the entire authentication for this route.
// Not throttled, for the same reason as the Razorpay payments webhook: a
// durable payout confirmation must never be dropped by a per-IP rate limit.
@Controller('api/v1/wallet/razorpayx/webhook')
export class RazorpayxPayoutWebhookController {
  private readonly logger = new Logger(RazorpayxPayoutWebhookController.name);

  constructor(private readonly walletManager: WalletManager) {}

  @Post()
  @HttpCode(200)
  @SkipThrottle()
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: { event: string; payload?: unknown },
  ) {
    if (!req.rawBody || !this.verifySignature(req.rawBody, signature)) {
      this.logger.warn('Rejected RazorpayX payout webhook with invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    await this.walletManager.handleRazorpayXPayoutWebhookEvent(
      body as Parameters<WalletManager['handleRazorpayXPayoutWebhookEvent']>[0],
    );

    return { received: true };
  }

  private verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    const webhookSecret = process.env.RAZORPAYX_WEBHOOK_SECRET;
    if (!webhookSecret || !signature) {
      return false;
    }

    const expectedHex = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(
      /^[0-9a-f]+$/i.test(signature) ? signature : '',
      'hex',
    );

    if (expected.length !== actual.length || actual.length === 0) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }
}
