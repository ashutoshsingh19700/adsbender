import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

import { AD_CATEGORIES } from '../../common/ad-categories';
import { ZONE_LAYOUT_TYPES } from '../../common/ad-formats';

// Same fields as CreateAdZoneDto, but all optional since this is a partial
// update (PATCH) - only send the fields you want to change.
export class UpdateAdZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  zoneName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  height?: number;

  @IsOptional()
  @IsIn(ZONE_LAYOUT_TYPES)
  layoutType?: string;

  @IsOptional()
  @IsArray()
  @IsIn(AD_CATEGORIES, { each: true })
  allowedCategories?: string[];
}
