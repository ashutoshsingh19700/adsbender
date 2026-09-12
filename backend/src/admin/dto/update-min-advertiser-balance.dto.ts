import { IsNumber, Max, Min } from 'class-validator';

export class UpdateMinAdvertiserBalanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000)
  minAdvertiserBalanceUsd: number;
}
