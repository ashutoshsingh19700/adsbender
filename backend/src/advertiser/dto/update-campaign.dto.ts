import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Same fields as CreateCampaignDto, but all optional (partial update).
// The service only allows this while the campaign is DRAFT or PAUSED -
// you can't edit a campaign that's currently live or under review.
export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  campaignName?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalBudget?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dailyBudget?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxCpc?: number;

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

  @IsOptional()
  @IsString()
  @IsIn(['image', 'html'])
  creativeType?: string;

  @ValidateIf((dto: UpdateCampaignDto) => dto.creativeType === 'image')
  @IsString()
  @MinLength(8)
  creativeUrl?: string;

  @ValidateIf((dto: UpdateCampaignDto) => dto.creativeType === 'html')
  @IsString()
  @MinLength(8)
  @MaxLength(5000)
  creativeHtml?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
