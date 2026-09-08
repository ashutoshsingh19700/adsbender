import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { WalletManager } from '../wallet/wallet-manager.service';
import { PayPalService, PayPalOrder } from './paypal.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PayPalService,
    private readonly walletManager: WalletManager,
  ) {}

  // Creates a PaymentOrder row + the matching PayPal order. Every order is
  // priced in USD - PayPal's own checkout shows non-US buyers (including
  // Indian ones) a local-currency estimate on its side, so there is no FX
  // logic here at all, unlike the old Razorpay INR flow.
  async createTopupOrder(userId: string, amountUsd: number) {
    const creditAmountUsd = new Prisma.Decimal(amountUsd).toDecimalPlaces(2);

    // Placeholder id, replaced with the real PayPal order id right after -
    // needed because the PaymentOrder row and the PayPal order reference
    // each other (reference_id <-> providerOrderId) and one has to exist
    // first.
    const order = await this.prisma.paymentOrder.create({
      data: {
        userId,
        provider: 'paypal',
        payCurrency: 'USD',
        payAmount: creditAmountUsd,
        creditAmountUsd,
        fxRate: null,
        providerOrderId: `pending:${randomUUID()}`,
      },
    });

    try {
      const paypalOrder = await this.paypal.createOrder(
        creditAmountUsd.toFixed(2),
        order.id,
      );

      const updated = await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { providerOrderId: paypalOrder.id },
      });

      return {
        paymentOrderId: updated.id,
        paypalOrderId: paypalOrder.id,
        paypalClientId: this.paypal.publicClientId,
        creditAmountUsd: creditAmountUsd.toString(),
        currency: 'USD' as const,
      };
    } catch (error) {
      // Order never reached PayPal (or the update failed) - mark it FAILED
      // rather than leaving a dangling CREATED row with a fake
      // providerOrderId that could never be confirmed anyway.
      await this.prisma.paymentOrder
        .update({
          where: { id: order.id },
          data: {
            status: 'FAILED',
            failureReason:
              error instanceof Error ? error.message : 'Order creation failed',
          },
        })
        .catch(() => undefined);

      throw error;
    }
  }

  // Client-side confirmation path: called by the browser right after the
  // buyer approves the order in the PayPal Buttons flow. The actual capture
  // call goes straight from this backend to PayPal - the browser only ever
  // supplies the order id, nothing it sends is trusted as "this was paid".
  // The webhook below is the durable fallback that still credits the wallet
  // even if the browser is closed/network drops right after approval.
  async confirmPayment(userId: string, paypalOrderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { providerOrderId: paypalOrderId },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Payment order not found');
    }

    if (order.status === 'PAID') {
      return { status: 'PAID' as const };
    }

    if (order.status === 'FAILED') {
      throw new BadRequestException('This order can no longer be paid');
    }

    const captureId = await this.captureAndExtractId(paypalOrderId);
    if (!captureId) {
      throw new BadRequestException('Payment was not completed');
    }

    await this.markPaidAndCredit(order.id, captureId);

    return { status: 'PAID' as const };
  }

  // Webhook entry point - PaymentsController has already verified the
  // request against PayPal's own verification API before this is called, so
  // `event` here can be trusted as genuinely from PayPal.
  //
  // Two event types matter, covering the "browser never came back" case:
  //  - CHECKOUT.ORDER.APPROVED: the buyer approved but nothing has captured
  //    it yet (e.g. they closed the tab right after approving) - capture it
  //    here so the money isn't left in limbo.
  //  - PAYMENT.CAPTURE.COMPLETED: defense in depth for a capture that
  //    happened through some other path - credit it if not already credited.
  // Both funnel into the same exactly-once markPaidAndCredit, so a retried
  // or duplicate webhook delivery (PayPal retries aggressively) is always a
  // safe no-op.
  async handleWebhookEvent(event: {
    event_type: string;
    resource?: {
      id?: string;
      status?: string;
      supplementary_data?: {
        related_ids?: { order_id?: string };
      };
    };
  }) {
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const paypalOrderId = event.resource?.id;
      if (!paypalOrderId) {
        return;
      }

      const order = await this.prisma.paymentOrder.findUnique({
        where: { providerOrderId: paypalOrderId },
      });

      if (!order) {
        this.logger.warn(`Webhook for unknown order ${paypalOrderId}`);
        return;
      }

      if (order.status !== 'CREATED') {
        return;
      }

      const captureId = await this.captureAndExtractId(paypalOrderId);
      if (captureId) {
        await this.markPaidAndCredit(order.id, captureId);
      }
      return;
    }

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = event.resource?.id;
      const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (!captureId || !paypalOrderId) {
        return;
      }

      const order = await this.prisma.paymentOrder.findUnique({
        where: { providerOrderId: paypalOrderId },
      });

      if (!order) {
        this.logger.warn(`Webhook for unknown order ${paypalOrderId}`);
        return;
      }

      await this.markPaidAndCredit(order.id, captureId);
      return;
    }

    if (
      event.event_type === 'PAYMENT.CAPTURE.DENIED' ||
      event.event_type === 'PAYMENT.CAPTURE.DECLINED'
    ) {
      const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (!paypalOrderId) {
        return;
      }

      await this.prisma.paymentOrder.updateMany({
        where: { providerOrderId: paypalOrderId, status: 'CREATED' },
        data: { status: 'FAILED', failureReason: 'Payment declined' },
      });
    }
  }

  // Captures the order and returns the capture id, treating "already
  // captured" (PayPal's ORDER_ALREADY_CAPTURED error, hit when the browser's
  // confirm call and the webhook's approve-handler race each other) as a
  // success rather than a failure - the existing capture id is fetched
  // instead of raising.
  private async captureAndExtractId(paypalOrderId: string): Promise<string | null> {
    const result = await this.paypal.captureOrder(paypalOrderId);

    if (this.paypal.isAlreadyCaptured(result)) {
      const order: PayPalOrder = await this.paypal.getOrder(paypalOrderId);
      return order.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
    }

    return (
      result.id ??
      result.purchase_units?.[0]?.payments?.captures?.[0]?.id ??
      null
    );
  }

  // The single exactly-once crediting path, shared by confirmPayment and
  // the webhook handler. The conditional `status: 'CREATED'` update is the
  // whole safety mechanism: only the caller that actually wins this
  // compare-and-swap goes on to credit the wallet, so it does not matter in
  // which order (or how many times) the confirm call and the webhook fire -
  // a duplicate or retried delivery is always a no-op past this point.
  private async markPaidAndCredit(
    paymentOrderId: string,
    providerPaymentId: string,
  ) {
    const result = await this.prisma.paymentOrder.updateMany({
      where: { id: paymentOrderId, status: 'CREATED' },
      data: { status: 'PAID', providerPaymentId },
    });

    if (result.count === 0) {
      // Already PAID (or FAILED, which shouldn't happen post-capture) -
      // another caller won the race, or this is a PayPal webhook retry.
      return;
    }

    const order = await this.prisma.paymentOrder.findUniqueOrThrow({
      where: { id: paymentOrderId },
    });

    try {
      await this.walletManager.deposit(order.userId, order.creditAmountUsd, {
        referenceId: providerPaymentId,
        description: `PayPal top-up ($${order.payAmount.toString()})`,
      });
    } catch (error) {
      // Order is now PAID but the wallet credit failed - should not happen
      // (see callers), but if it ever does this must be loud: a paid order
      // with no matching ledger entry is money the advertiser sent that
      // silently never reached their wallet.
      this.logger.error(
        `Order ${order.id} marked PAID but wallet credit failed for payment ${providerPaymentId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
