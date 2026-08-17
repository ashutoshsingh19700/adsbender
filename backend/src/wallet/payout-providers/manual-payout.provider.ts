import { Injectable, Logger } from '@nestjs/common';
import { Payout } from '@prisma/client';

import {
  PayoutProvider,
  PayoutSubmissionResult,
} from './payout-provider.interface';

// Default provider used because no payment/payout gateway is configured
// (no Stripe/Razorpay keys etc. in env). It doesn't move any money - it just
// puts the payout in PROCESSING so it shows up in an ops queue, where a
// human (an ADMIN, via WalletManager.completePayout/failPayout) confirms the
// bank transfer actually happened. Swap PAYOUT_PROVIDER in WalletModule for
// a real implementation of PayoutProvider once credentials exist.
@Injectable()
export class ManualPayoutProvider implements PayoutProvider {
  readonly name = 'manual';
  private readonly logger = new Logger(ManualPayoutProvider.name);

  submit(payout: Payout): Promise<PayoutSubmissionResult> {
    this.logger.log(
      `Payout ${payout.id} for ${payout.amount.toString()} ${payout.currency} queued for manual processing`,
    );

    return Promise.resolve({ status: 'PROCESSING' });
  }
}
