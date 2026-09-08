import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

// Thin wrapper around PayPal's REST API (Orders v2 + webhook verification).
// Nothing here touches the wallet or the ledger - PaymentsService owns that,
// this is purely "talk to PayPal correctly and safely". Uses plain fetch
// against the REST API rather than PayPal's SDK so token caching, error
// handling (esp. "already captured") and webhook verification are all
// explicit and under our control.
@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);

  // OAuth2 client-credentials token, cached until shortly before it expires
  // so we don't round-trip to PayPal for a new token on every single order
  // create/capture call.
  private cachedToken: { value: string; expiresAt: number } | null = null;

  private get baseUrl(): string {
    return process.env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  get publicClientId(): string {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured yet',
      );
    }
    return clientId;
  }

  private getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured yet',
      );
    }

    return { clientId, clientSecret };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.value;
    }

    const { clientId, clientSecret } = this.getCredentials();
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`PayPal token request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('Could not reach payment gateway');
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.cachedToken = {
      value: data.access_token,
      // Refresh a minute early so an in-flight request never races an
      // expiry that happens mid-call.
      expiresAt: now + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, status: response.status, data };
  }

  // `amountUsd` is a decimal-string major-unit amount ("12.50") - PayPal's
  // Orders v2 API wants amounts as decimal strings, unlike Razorpay's
  // integer-minor-units convention.
  async createOrder(amountUsd: string, referenceId: string) {
    const { ok, status, data } = await this.request<{
      id: string;
      status: string;
    }>('/v2/checkout/orders', {
      method: 'POST',
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: referenceId,
            amount: { currency_code: 'USD', value: amountUsd },
          },
        ],
      },
    });

    if (!ok) {
      this.logger.error(`PayPal order create failed: ${status} ${JSON.stringify(data)}`);
      throw new ServiceUnavailableException('Could not create payment order');
    }

    return data;
  }

  async getOrder(paypalOrderId: string) {
    const { ok, status, data } = await this.request<PayPalOrder>(
      `/v2/checkout/orders/${paypalOrderId}`,
      { method: 'GET' },
    );

    if (!ok) {
      this.logger.error(`PayPal get order failed: ${status} ${JSON.stringify(data)}`);
      throw new ServiceUnavailableException('Could not reach payment gateway');
    }

    return data;
  }

  // Captures an approved order. PayPal returns 422 ORDER_ALREADY_CAPTURED if
  // this order was already captured (e.g. the webhook and the browser's
  // confirm call both raced to capture it) - that is treated as success by
  // the caller (see PaymentsService.extractCaptureId), not as an error.
  async captureOrder(paypalOrderId: string): Promise<PayPalCaptureResult> {
    const { ok, status, data } = await this.request<PayPalCaptureResult>(
      `/v2/checkout/orders/${paypalOrderId}/capture`,
      { method: 'POST' },
    );

    if (!ok && !this.isAlreadyCaptured(data)) {
      this.logger.error(`PayPal capture failed: ${status} ${JSON.stringify(data)}`);
      throw new ServiceUnavailableException('Could not capture payment');
    }

    return data;
  }

  isAlreadyCaptured(data: unknown): boolean {
    const details = (data as { details?: Array<{ issue?: string }> })?.details;
    return details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED') ?? false;
  }

  // Asks PayPal itself to confirm a webhook delivery is genuine, using the
  // transmission headers PayPal sends with every webhook request plus the
  // parsed event body. This is PayPal's documented verification mechanism -
  // unlike Razorpay there is no local-HMAC shortcut, the round trip to
  // PayPal's API *is* the verification.
  async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      this.logger.error('PAYPAL_WEBHOOK_ID is not set - rejecting webhook');
      return false;
    }

    const header = (name: string): string | undefined => {
      const value = headers[name];
      return Array.isArray(value) ? value[0] : value;
    };

    const transmissionId = header('paypal-transmission-id');
    const transmissionTime = header('paypal-transmission-time');
    const certUrl = header('paypal-cert-url');
    const authAlgo = header('paypal-auth-algo');
    const transmissionSig = header('paypal-transmission-sig');

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      return false;
    }

    try {
      const { ok, data } = await this.request<{
        verification_status: string;
      }>('/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        body: {
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: body,
        },
      });

      return ok && data.verification_status === 'SUCCESS';
    } catch (error) {
      this.logger.error(
        'PayPal webhook verification request failed',
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }
}

export type PayPalCaptureResult = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    payments?: { captures?: Array<{ id: string; status: string }> };
  }>;
  details?: Array<{ issue?: string }>;
};

export type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    payments?: { captures?: Array<{ id: string; status: string }> };
  }>;
};
