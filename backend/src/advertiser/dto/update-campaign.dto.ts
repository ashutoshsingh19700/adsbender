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
const CONNECTION_TYPES = ['WIFI', 'MOBILE_DATA', 'ALL'] as const;

// Same shape as CreateCampaignDto's - see there for field notes.
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

// Same fields as CreateCampaignDto, but all optional (partial update).
// The service only allows this while the campaign is DRAFT or PAUSED -
// you can't edit a campaign that's currently live or under review.
export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  campaignName?: string;

  // Same $10 floor as CreateCampaignDto.totalBudget - see the comment there.
  @IsOptional()
  @IsNumber()
  @Min(10)
  totalBudget?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  dailyBudget?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxCpc?: number;

  // See CreateCampaignDto - CPM bid override.
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxCpm?: number;

  // See CreateCampaignDto - CPA bid override.
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxCpa?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetCountries?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetDevices?: string[];

  // See CreateCampaignDto - optional refinement within targetDevices.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetOperatingSystems?: string[];

  @IsOptional()
  @IsIn(CONNECTION_TYPES)
  connectionType?: (typeof CONNECTION_TYPES)[number];

  @IsOptional()
  @IsString()
  @IsIn(['image', 'video', 'html'])
  creativeType?: string;

  @ValidateIf(
    (dto: UpdateCampaignDto) =>
      dto.creativeType === 'image' || dto.creativeType === 'video',
  )
  @IsString()
  @MinLength(8)
  creativeUrl?: string;

  @ValidateIf((dto: UpdateCampaignDto) => dto.creativeType === 'html')
  @IsString()
  @MinLength(8)
  @MaxLength(5000)
  creativeHtml?: string;

  // See CreateCampaignDto.destinationUrl - same rule: required+validated
  // for 'image'/'video', format-checked-if-present but optional for 'html'.
  @ValidateIf(
    (dto: UpdateCampaignDto) =>
      dto.creativeType === 'image' ||
      dto.creativeType === 'video' ||
      (dto.destinationUrl !== undefined && dto.destinationUrl !== ''),
  )
  @IsUrl({ require_protocol: true })
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // See CreateCampaignDto - per-campaign frequency-cap override.
  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyCapImpressions?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  frequencyCapWindowSeconds?: number;

  // --- Adsterra-style setup fields - see CreateCampaignDto ---

  @IsOptional()
  @IsIn(AD_FORMATS)
  adFormat?: (typeof AD_FORMATS)[number];

  @IsOptional()
  @IsIn(PRICING_MODELS)
  pricingModel?: (typeof PRICING_MODELS)[number];

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

  @ValidateIf((dto: UpdateCampaignDto) => dto.startMode === 'SCHEDULE')
  @IsISO8601()
  scheduledAt?: string;
}
