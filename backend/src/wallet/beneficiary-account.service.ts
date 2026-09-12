import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SetBeneficiaryAccountDto } from './dto/set-beneficiary-account.dto';

// A publisher's payout destination (bank account or UPI VPA) - read by
// RazorpayXPayoutProvider when a payout is submitted. Kept as its own small
// service rather than folded into WalletManager since it never touches a
// balance or the ledger, just contact details.
@Injectable()
export class BeneficiaryAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrNull(userId: string) {
    return this.prisma.beneficiaryAccount.findUnique({ where: { userId } });
  }

  // Creates or replaces the publisher's payout destination. Always clears
  // the cached RazorpayX contact/fund-account ids - reusing a fund account
  // created against the OLD bank details would keep paying out to an
  // account the publisher just changed away from.
  async upsert(userId: string, dto: SetBeneficiaryAccountDto) {
    if (dto.accountType === 'BANK_ACCOUNT') {
      if (!dto.bankAccountNumber || !dto.ifscCode) {
        throw new BadRequestException(
          'bankAccountNumber and ifscCode are required for a bank account',
        );
      }
    } else if (!dto.vpa) {
      throw new BadRequestException('vpa is required for a UPI account');
    }

    const data = {
      accountType: dto.accountType,
      accountHolderName: dto.accountHolderName,
      bankAccountNumber:
        dto.accountType === 'BANK_ACCOUNT' ? dto.bankAccountNumber : null,
      ifscCode: dto.accountType === 'BANK_ACCOUNT' ? dto.ifscCode : null,
      vpa: dto.accountType === 'VPA' ? dto.vpa : null,
      razorpayContactId: null,
      razorpayFundAccountId: null,
    };

    return this.prisma.beneficiaryAccount.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  // Called by RazorpayXPayoutProvider once it creates the Contact/Fund
  // Account for this beneficiary, so subsequent payouts reuse them instead
  // of creating a new one every time.
  async saveRazorpayIds(
    userId: string,
    ids: { razorpayContactId?: string; razorpayFundAccountId?: string },
  ) {
    await this.prisma.beneficiaryAccount.update({
      where: { userId },
      data: ids,
    });
  }
}
