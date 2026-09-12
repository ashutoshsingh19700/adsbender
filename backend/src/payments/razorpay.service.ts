import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

// Thin wrapper around the Razorpay Checkout SDK/HMAC verification. Nothing
// here touches the wallet or the ledger - PaymentsService owns that, this is
// purely "talk to Razorpay correctly and safely". Sibling to PayPalService;
// advertisers pick either gateway at checkout (see PaymentsService).
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private client: Razorpay | null = null;

  // Lazily constructed (not in the constructor) so the app still boots with
  // no Razorpay keys configured at all - only a request that actually needs
  // the gateway fails, with a clear error, instead of the whole process
  // refusing to start.
  private getClient(): Razorpay {
    if (this.client) {
      return this.client;
    }

    const { keyId, keySecret } = this.getCredentials();
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    return this.client;
  }

  private getCredentials(): { keyId: string; keySecret: string } {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured yet',
      );
    }

    return { keyId, keySecret };
  }

  get publicKeyId(): string {
    return this.getCredentials().keyId;
  }

  // `amountMinorUnits` is the smallest unit of `currency` (paise for INR,
  // cents for USD) - Razorpay always expects an integer in that unit, never
  // a decimal major-unit amount.
  async createOrder(
    amountMinorUnits: number,
    currency: string,
    receipt: string,
  ) {
    const client = this.getClient();

    try {
      return await client.orders.create({
        amount: amountMinorUnits,
        currency,
        receipt,
        // Razorpay refuses to auto-capture international-currency orders in
        // some account configurations; explicit "automatic" keeps behaviour
        // consistent across INR and USD so a successful checkout is always
        // immediately captured rather than left AUTHORIZED and un-billed.
        payment_capture: true,
      });
    } catch (error) {
      this.logger.error(
        `Razorpay order create failed: ${error instanceof Error ? error.message : error}`,
      );
      throw new ServiceUnavailableException('Could not create payment order');
    }
  }

  // Verifies the signature the Razorpay Checkout success handler hands back
  // to the browser (order_id|payment_id signed with the key secret). This is
  // the fast, user-facing confirmation path - the webhook below is the
  // durable one that still fires even if the browser never calls back.
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const { keySecret } = this.getCredentials();

    const expected = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return this.safeEqual(expected, signature);
  }

  // Verifies the `X-Razorpay-Signature` header against the RAW request body
  // using the separate webhook secret (Dashboard > Webhooks, NOT the API key
  // secret). This is the only thing that authenticates an inbound webhook
  // request - there is no session/JWT on this route, so a wrong or missing
  // secret must hard-fail closed, never fall back to "trust it anyway".
  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      this.logger.error(
        'RAZORPAY_WEBHOOK_SECRET is not set - rejecting webhook',
      );
      return false;
    }

    if (!signature) {
      return false;
    }

    const expected = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return this.safeEqual(expected, signature);
  }

  private safeEqual(expectedHex: string, actualHex: string): boolean {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(
      /^[0-9a-f]+$/i.test(actualHex) ? actualHex : '',
      'hex',
    );

    // timingSafeEqual throws on length mismatch rather than returning
    // false, and a malformed (non-hex) header would otherwise throw before
    // we even get to compare - both must resolve to a plain `false`.
    if (expected.length !== actual.length || actual.length === 0) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }
}
