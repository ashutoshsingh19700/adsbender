import { IsNumber, Max, Min } from 'class-validator';

export class UpdateUsdToInrRateDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(1000)
  usdToInrRate: number;
}
