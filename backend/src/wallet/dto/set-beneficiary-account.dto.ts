import { IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';

// A publisher's payout destination. Exactly one of the BANK_ACCOUNT or VPA
// field groups is required, matching accountType - enforced with
// ValidateIf rather than two separate DTOs so the controller has one simple
// shape to validate against.
export class SetBeneficiaryAccountDto {
  @IsIn(['BANK_ACCOUNT', 'VPA'])
  accountType: 'BANK_ACCOUNT' | 'VPA';

  @IsString()
  @MaxLength(120)
  accountHolderName: string;

  @ValidateIf((o: SetBeneficiaryAccountDto) => o.accountType === 'BANK_ACCOUNT')
  @IsString()
  @MaxLength(34)
  bankAccountNumber?: string;

  @ValidateIf((o: SetBeneficiaryAccountDto) => o.accountType === 'BANK_ACCOUNT')
  @IsString()
  @MaxLength(11)
  ifscCode?: string;

  @ValidateIf((o: SetBeneficiaryAccountDto) => o.accountType === 'VPA')
  @IsString()
  @MaxLength(100)
  vpa?: string;
}
