import { IsNumber, IsString, Min } from 'class-validator';

// Updates the rate for ONE ad format at a time - see
// PlatformSettingsService.updateAdFormatPricing for why a single-row PATCH
// is safer than replacing the whole rate card.
export class UpdateAdFormatPricingDto {
  @IsString()
  adFormat: string;

  @IsNumber()
  @Min(0)
  cpm: number;

  @IsNumber()
  @Min(0)
  cpa: number;

  @IsNumber()
  @Min(0)
  cpc: number;
}
