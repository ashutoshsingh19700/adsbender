import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

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
}
