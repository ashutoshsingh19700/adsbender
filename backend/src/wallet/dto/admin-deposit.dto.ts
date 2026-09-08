import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Manual, ADMIN-only wallet credit - NOT the advertiser top-up path (that's
// PaymentsController, gated on a verified PayPal payment). This is for
// ops reconciling something outside the gateway (a bank transfer, a
// goodwill credit), so unlike a PayPal-sourced deposit it requires a
// human-readable reason and an explicit target user.
export class AdminDepositDto {
  @IsString()
  userId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  amount: number;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
