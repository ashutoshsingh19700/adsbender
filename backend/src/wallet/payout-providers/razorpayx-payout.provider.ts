import { Injectable, Logger } from '@nestjs/common';
import { Payout, Prisma } from '@prisma/client';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { BeneficiaryAccountService } from '../beneficiary-account.service';
import {
  PayoutProvider,
  PayoutSubmissionResult,
} from './payout-provider.interface';

// Real payout gateway: RazorpayX Payouts API (Contacts -> Fund Accounts ->
// Payouts). Only wired up as the active provider (see WalletModule) when
// RAZORPAYX_KEY_ID/SECRET/ACCOUNT_NUMBER are all set - a fresh install with
// no RazorpayX account still falls back to ManualPayoutProvider.
//
// RazorpayX is INR-only (it pays into Indian bank accounts/UPI IDs), but
// the wallet ledger is USD - every payout is converted at submit time using
// PlatformSettingsService.getUsdToInrRate() and the INR amount actually
// paid, plus the rate used, is recorded on Payout.metadata for
// reconciliation. Unlike the top-up flow (which locks in USD at order
// creation and never recomputes it), there is no equivalent lock-in here:
// the publisher is always credited the full USD amount already reserved in
// requestPayout, and only the INR conversion is decided at submit time.
@Injectable()
export class RazorpayXPayoutProvider implements PayoutProvider {
  readonly name = 'razorpayx';
  private readonly logger = new Logger(RazorpayXPayoutProvider.name);

  constructor(
    private readonly beneficiaryAccounts: BeneficiaryAccountService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private get baseUrl(): string {
    return 'https://api.razorpay.com/v1';
  }

  private getCredentials(): { keyId: string; keySecret: string; account: string } {
    const keyId = process.env.RAZORPAYX_KEY_ID;
    const keySecret = process.env.RAZORPAYX_KEY_SECRET;
    const account = process.env.RAZORPAYX_ACCOUNT_NUMBER;

    if (!keyId || !keySecret || !account) {
      throw new Error('RazorpayX is not configured');
    }

    return { keyId, keySecret, account };
  }

  private async request<T>(
    path: string,
    body: unknown,
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const { keyId, keySecret } = this.getCredentials();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, status: response.status, data };
  }

  // A payout can never actually be attempted without a beneficiary account
  // and configured RazorpayX credentials - both surface as a normal FAILED
  // result (funds return to the publisher's available balance via
  // WalletManager.failPayout) rather than an unhandled exception, same as
  // every other failure path here.
  async submit(payout: Payout): Promise<PayoutSubmissionResult> {
    try {
      this.getCredentials();
    } catch {
      return { status: 'FAILED', failureReason: 'RazorpayX is not configured' };
    }

    const beneficiary = await this.beneficiaryAccounts.getOrNull(payout.userId);
    if (!beneficiary) {
      return {
        status: 'FAILED',
        failureReason: 'No payout bank/UPI account on file',
      };
    }

    try {
      const fundAccountId = await this.ensureFundAccount(beneficiary);

      const fxRate = await this.platformSettings.getUsdToInrRate();
      const amountInr = new Prisma.Decimal(payout.amount)
        .times(fxRate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const amountPaise = amountInr
        .times(100)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();

      const { account } = this.getCredentials();
      const { ok, status, data } = await this.request<{
        id: string;
        status: string;
      }>('/payouts', {
        account_number: account,
        fund_account_id: fundAccountId,
        amount: amountPaise,
        currency: 'INR',
        mode: beneficiary.accountType === 'VPA' ? 'UPI' : 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: payout.id,
        narration: 'Publisher payout',
      });

      if (!ok) {
        this.logger.error(
          `RazorpayX payout create failed: ${status} ${JSON.stringify(data)}`,
        );
        return {
          status: 'FAILED',
          failureReason: 'RazorpayX rejected the payout request',
        };
      }

      // "processed" can come back synchronously for some modes (e.g. UPI);
      // everything else (queued, pending, processing) settles later via the
      // payout.processed/payout.failed/payout.reversed webhook - see
      // RazorpayxPayoutWebhookController.
      if (data.status === 'processed') {
        return { status: 'COMPLETED', providerRef: data.id };
      }
      if (data.status === 'rejected' || data.status === 'cancelled') {
        return {
          status: 'FAILED',
          failureReason: `RazorpayX payout ${data.status}`,
          providerRef: data.id,
        };
      }

      return { status: 'PROCESSING', providerRef: data.id };
    } catch (error) {
      this.logger.error(
        'RazorpayX payout submission failed',
        error instanceof Error ? error.stack : error,
      );
      return {
        status: 'FAILED',
        failureReason: 'Could not reach RazorpayX',
      };
    }
  }

  // Creates (and caches on the BeneficiaryAccount row) the RazorpayX
  // Contact + Fund Account backing this beneficiary, or reuses them if a
  // prior payout already created them. Not wrapped per-call in a lock -
  // worst case under a genuine race is one harmless duplicate Contact/Fund
  // Account at RazorpayX, not a double payout (that's guarded by
  // WalletManager's row-level locking on the Payout/balance itself).
  private async ensureFundAccount(
    beneficiary: NonNullable<
      Awaited<ReturnType<BeneficiaryAccountService['getOrNull']>>
    >,
  ): Promise<string> {
    if (beneficiary.razorpayFundAccountId) {
      return beneficiary.razorpayFundAccountId;
    }

    let contactId = beneficiary.razorpayContactId;
    if (!contactId) {
      const { ok, status, data } = await this.request<{ id: string }>(
        '/contacts',
        {
          name: beneficiary.accountHolderName,
          type: 'vendor',
          reference_id: beneficiary.userId,
        },
      );

      if (!ok) {
        throw new Error(
          `RazorpayX contact create failed: ${status} ${JSON.stringify(data)}`,
        );
      }
      contactId = data.id;
    }

    const fundAccountBody =
      beneficiary.accountType === 'VPA'
        ? {
            contact_id: contactId,
            account_type: 'vpa',
            vpa: { address: beneficiary.vpa },
          }
        : {
            contact_id: contactId,
            account_type: 'bank_account',
            bank_account: {
              name: beneficiary.accountHolderName,
              ifsc: beneficiary.ifscCode,
              account_number: beneficiary.bankAccountNumber,
            },
          };

    const { ok, status, data } = await this.request<{ id: string }>(
      '/fund_accounts',
      fundAccountBody,
    );

    if (!ok) {
      throw new Error(
        `RazorpayX fund account create failed: ${status} ${JSON.stringify(data)}`,
      );
    }

    await this.beneficiaryAccounts.saveRazorpayIds(beneficiary.userId, {
      razorpayContactId: contactId,
      razorpayFundAccountId: data.id,
    });

    return data.id;
  }
}
