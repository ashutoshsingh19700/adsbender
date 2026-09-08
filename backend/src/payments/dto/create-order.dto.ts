import { IsNumber, Max, Min } from 'class-validator';

export class CreateOrderDto {
  // Always the USD amount to be credited to the wallet - PayPal orders are
  // always created in USD (see PaymentsService.createTopupOrder); PayPal's
  // own checkout shows non-US buyers a local-currency estimate on its side.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100_000)
  amountUsd: number;
}
