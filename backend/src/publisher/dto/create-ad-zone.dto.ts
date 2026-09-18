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

export class CreateAdZoneDto {
  @IsString()
  @MinLength(2)
  zoneName: string;

  // Ties this zone to one of the publisher's sites, so it shows up nested
  // under that site on the Websites page. Optional - zones can still be
  // created standalone from the generic Publisher Portal flow.
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsInt()
  @Min(1)
  @Max(4000)
  width: number;

  @IsInt()
  @Min(1)
  @Max(4000)
  height: number;

  // Must be a real format from the shared catalog, or one of the
  // pre-catalog legacy values (see ZONE_LAYOUT_TYPES) - AdTargetingService
  // matches a campaign's adFormat against this exact value, so a
  // typo'd/free-text layoutType would silently never match any campaign
  // and the zone would never serve anything.
  @IsIn(ZONE_LAYOUT_TYPES)
  layoutType: string;

  // Restricts this zone to serving only campaigns whose category is in this
  // list - see AdTargetingService.isEligible. Optional/empty means no
  // restriction (any category can serve here).
  @IsOptional()
  @IsArray()
  @IsIn(AD_CATEGORIES, { each: true })
  allowedCategories?: string[];
}
