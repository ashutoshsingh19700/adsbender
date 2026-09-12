import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { AD_FORMATS } from '../../common/ad-formats';

const PRICING_MODELS = ['CPM', 'CPA', 'CPC'] as const;
const START_MODES = [
  'START_ONCE_VERIFIED',
  'SCHEDULE',
  'KEEP_INACTIVE',
] as const;

// Mirrors Campaign.locations in schema.prisma - one region/city
// include/exclude rule. Stored as-is in the `locations` Json column; not
// yet read by AdEngineController.
class CampaignLocationDto {
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsBoolean()
  include: boolean;
}

export class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  campaignName: string;

  @IsNumber()
  @Min(0.01)
  totalBudget: number;

  @IsNumber()
  @Min(0.01)
  dailyBudget: number;

  @IsNumber()
  @Min(0.01)
  maxCpc: number;

  // Bid per 1000 impressions - opts this campaign into CPM billing (billed
  // in lump sums every 1000 impressions) instead of the default
  // pay-per-click model. Leave unset to stay on CPC/maxCpc.
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxCpm?: number;

  // Bid per verified conversion - opts this campaign into CPA billing
  // (charged only when the advertiser confirms a conversion via
  // GET /api/v1/conversion, never on click). Not mutually exclusive with
  // maxCpm; still competes for ad-serving on maxCpc either way.
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxCpa?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetCountries: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetDevices: string[];

  @IsString()
  @IsIn(['image', 'video', 'html'])
  creativeType: string;

  @ValidateIf(
    (dto: CreateCampaignDto) =>
      dto.creativeType === 'image' || dto.creativeType === 'video',
  )
  @IsString()
  @MinLength(8)
  creativeUrl?: string;

  @ValidateIf((dto: CreateCampaignDto) => dto.creativeType === 'html')
  @IsString()
  @MinLength(8)
  @MaxLength(5000)
  creativeHtml?: string;

  // Required for image/video creatives - AdEngineController wraps the
  // rendered <img>/<video> in a click-tracked link to this address, and an
  // ad with nowhere to click is a UI bug, not a valid campaign. Optional for
  // 'html' (stored for reference only, never auto-wrapped: raw HTML often
  // already has its own <a>/<button>/<form> elements, and wrapping the
  // whole block in an outer anchor would produce invalid nested-interactive
  // markup) - but still format-checked whenever a value is actually given.
  @ValidateIf(
    (dto: CreateCampaignDto) =>
      dto.creativeType === 'image' ||
      dto.creativeType === 'video' ||
      (dto.destinationUrl !== undefined && dto.destinationUrl !== ''),
  )
  @IsUrl({ require_protocol: true })
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Per-campaign override for AdEngine's per-visitor frequency cap - see
  // Campaign.frequencyCapImpressions in schema.prisma. Leave both unset to
  // use the platform default (VisitorFrequencyCapService).
  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyCapImpressions?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  frequencyCapWindowSeconds?: number;

  // --- Adsterra-style setup fields (see schema.prisma - Campaign) ---
  // All optional and stored as-is; none of these are read by
  // AdEngineController's serving logic yet.

  @IsOptional()
  @IsIn(AD_FORMATS)
  adFormat?: (typeof AD_FORMATS)[number];

  @IsOptional()
  @IsIn(PRICING_MODELS)
  pricingModel?: (typeof PRICING_MODELS)[number];

  // { "US": 1.2, "IN": 0.4, ... } - per-country bid override.
  @IsOptional()
  @IsObject()
  countryPricing?: Record<string, number>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignLocationDto)
  locations?: CampaignLocationDto[];

  @IsOptional()
  @IsBoolean()
  budgetUnlimited?: boolean;

  @IsOptional()
  @IsIn(START_MODES)
  startMode?: (typeof START_MODES)[number];

  @ValidateIf((dto: CreateCampaignDto) => dto.startMode === 'SCHEDULE')
  @IsISO8601()
  scheduledAt?: string;
}
