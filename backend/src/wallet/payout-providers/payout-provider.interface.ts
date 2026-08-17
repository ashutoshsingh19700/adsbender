import { Payout } from '@prisma/client';

// Result of handing a REQUESTED payout off to whatever actually moves money.
// A provider never touches wallet balances or the ledger itself - the
// WalletManager does that based on the status it returns here.
export type PayoutSubmissionResult = {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  providerRef?: string;
  failureReason?: string;
};

// Clean seam for wiring up a real payment/payout gateway (Stripe Connect
// transfers, Razorpay Payouts, a bank file export, ...) later without
// touching WalletManager. Bind a different implementation to this token in
// WalletModule once real provider credentials exist.
export const PAYOUT_PROVIDER = Symbol('PAYOUT_PROVIDER');

export interface PayoutProvider {
  readonly name: string;
  submit(payout: Payout): Promise<PayoutSubmissionResult>;
}
