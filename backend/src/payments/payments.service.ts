import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { WalletManager } from '../wallet/wallet-manager.service';
import { RazorpayService } from './razorpay.service';

type PayCurrency = 'INR' | 'USD';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly walletManager: WalletManager,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  // Creates a PaymentOrder row + the matching Razorpay order. The USD amount
  // credited on success is fixed right here - everything downstream
  // (Checkout, the verify call, the webhook) just confirms "did this exact
  // order get paid", it never re-derives or re-prices the amount.
  async createTopupOrder(
    userId: string,
    amountUsd: number,
    payCurrency: PayCurrency,
  ) {
    const creditAmountUsd = new Prisma.Decimal(amountUsd).toDecimalPlaces(2);

    let payAmount: Prisma.Decimal;
    let fxRate: Prisma.Decimal | null = null;

    if (payCurrency === 'USD') {
      payAmount = creditAmountUsd;
    } else {
      fxRate = await this.platformSettings.getUsdToInrRate();
      payAmount = creditAmountUsd
        .times(fxRate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }

    // Placeholder id, replaced with the real Razorpay order id right after -
    // needed because the PaymentOrder row and the Razorpay order reference
    // each other (receipt <-> providerOrderId) and one has to exist first.
    const order = await this.prisma.paymentOrder.create({
      data: {
        userId,
        payCurrency,
        payAmount,
        creditAmountUsd,
        fxRate,
        providerOrderId: `pending:${randomUUID()}`,
      },
    });

    try {
      const razorpayOrder = await this.razorpay.createOrder(
        this.toMinorUnits(payAmount),
        payCurrency,
        order.id,
      );

      const updated = await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { providerOrderId: razorpayOrder.id },
      });

      return {
        paymentOrderId: updated.id,
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId: this.razorpay.publicKeyId,
        payAmount: payAmount.toString(),
        payCurrency,
        creditAmountUsd: creditAmountUsd.toString(),
      };
    } catch (error) {
      // Order never reached Razorpay (or the update failed) - mark it FAILED
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

  // Client-side confirmation path: called by the browser right after
  // Razorpay Checkout's success handler fires. Fast UX feedback - the
  // webhook (handleWebhookEvent below) is what makes crediting reliable even
  // if the browser is closed/network drops before this ever gets called.
  async confirmPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { providerOrderId: razorpayOrderId },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Payment order not found');
    }

    if (order.status === 'PAID') {
      return { status: 'PAID' as const };
    }

    const validSignature = this.razorpay.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!validSignature) {
      throw new BadRequestException('Invalid payment signature');
    }

    await this.markPaidAndCredit(order.id, razorpayPaymentId);

    return { status: 'PAID' as const };
  }

  // Webhook entry point - PaymentsController has already verified the
  // request signature against the raw body before this is called, so
  // `event` here can be trusted as genuinely from Razorpay.
  async handleWebhookEvent(event: {
    event: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          error_description?: string;
        };
      };
    };
  }) {
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) {
      return;
    }

    const order = await this.prisma.paymentOrder.findUnique({
      where: { providerOrderId: payment.order_id },
    });

    if (!order) {
      // A webhook for an order this service never created (different
      // Razorpay account/environment sharing the same endpoint, or a stale
      // test event) - nothing to do, and definitely nothing to credit.
      this.logger.warn(`Webhook for unknown order ${payment.order_id}`);
      return;
    }

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      await this.markPaidAndCredit(order.id, payment.id);
      return;
    }

    if (event.event === 'payment.failed') {
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: 'CREATED' },
        data: {
          status: 'FAILED',
          failureReason: payment.error_description ?? 'Payment failed',
        },
      });
    }
  }

  // The single exactly-once crediting path, shared by confirmPayment and
  // the webhook handler. The conditional `status: 'CREATED'` update is the
  // whole safety mechanism: only the caller that actually wins this
  // compare-and-swap goes on to credit the wallet, so it does not matter in
  // which order (or how many times) the verify call and the webhook fire.
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
      // another caller won the race, or this is a Razorpay webhook retry.
      return;
    }

    const order = await this.prisma.paymentOrder.findUniqueOrThrow({
      where: { id: paymentOrderId },
    });

    try {
      await this.walletManager.deposit(order.userId, order.creditAmountUsd, {
        referenceId: providerPaymentId,
        description: `Razorpay top-up (${order.payCurrency} ${order.payAmount.toString()})`,
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

  // Razorpay wants an integer in the currency's smallest unit - both INR
  // (paise) and USD (cents) are 2-decimal currencies, so this is just
  // "multiply by 100 and round", but it's centralized here in case a
  // 0-decimal currency is ever added.
  private toMinorUnits(amount: Prisma.Decimal): number {
    return amount
      .times(100)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber();
  }
}
