import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { SiteStatus } from '@prisma/client';

// A publisher site's identity (domain, verification) is set by the
// domains/validate flow. This endpoint additionally lets a publisher
// activate/deactivate the site, or update its category / adult-ads
// preference without re-running verification.
export class UpdateSiteDto {
  @IsOptional()
  @IsEnum(SiteStatus)
  status?: SiteStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  adultAds?: boolean;
}
