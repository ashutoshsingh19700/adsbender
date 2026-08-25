import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
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

const AD_FORMATS = [
  'POPUNDER',
  'SOCIAL_BAR',
  'NATIVE_BANNER',
  'IN_PAGE_PUSH',
  'INTERSTITIAL',
] as const;
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
  @Min(1)
  totalBudget: number;

  @IsNumber()
  @Min(1)
  dailyBudget: number;

  @IsNumber()
  @Min(0.01)
  maxCpc: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetCountries: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetDevices: string[];

  @IsString()
  @IsIn(['image', 'html'])
  creativeType: string;

  @ValidateIf((dto: CreateCampaignDto) => dto.creativeType === 'image')
  @IsString()
  @MinLength(8)
  creativeUrl?: string;

  @ValidateIf((dto: CreateCampaignDto) => dto.creativeType === 'html')
  @IsString()
  @MinLength(8)
  @MaxLength(5000)
  creativeHtml?: string;

  // Required for image creatives - AdEngineController wraps the rendered
  // <img> in a click-tracked link to this address, and an image ad with
  // nowhere to click is a UI bug, not a valid campaign. Optional for
  // 'html' (stored for reference only, never auto-wrapped: raw HTML often
  // already has its own <a>/<button>/<form> elements, and wrapping the
  // whole block in an outer anchor would produce invalid nested-interactive
  // markup) - but still format-checked whenever a value is actually given.
  @ValidateIf(
    (dto: CreateCampaignDto) =>
      dto.creativeType === 'image' ||
      (dto.destinationUrl !== undefined && dto.destinationUrl !== ''),
  )
  @IsUrl({ require_protocol: true })
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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
