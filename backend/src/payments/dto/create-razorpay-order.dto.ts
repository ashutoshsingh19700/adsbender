import { IsIn, IsNumber, Max, Min } from 'class-validator';

export class CreateRazorpayOrderDto {
  // The USD amount to be credited to the wallet - fixed at order creation
  // and never recomputed (see PaymentsService.createRazorpayOrder), even if
  // payCurrency is INR and the FX rate moves between order creation and
  // payment.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100_000)
  amountUsd: number;

  // What the advertiser is actually charged in. INR uses the admin-set
  // usdToInrRate (PlatformSettingsService.getUsdToInrRate) to convert the
  // fixed USD credit into a rupee charge; USD charges that amount directly.
  @IsIn(['INR', 'USD'])
  payCurrency: 'INR' | 'USD';
}
