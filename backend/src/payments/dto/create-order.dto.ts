import { IsIn, IsNumber, Max, Min } from 'class-validator';

export class CreateOrderDto {
  // Always the USD amount to be credited to the wallet, regardless of which
  // currency the advertiser actually pays in - see PaymentOrder.creditAmountUsd.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100_000)
  amountUsd: number;

  @IsIn(['INR', 'USD'])
  payCurrency: 'INR' | 'USD';
}
