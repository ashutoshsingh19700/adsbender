import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { SiteStatus } from '@prisma/client';

// A publisher site's identity (domain, verification) is set by the
// domains/validate flow. This endpoint additionally lets a publisher
// activate/deactivate the site, or update its category / adult-ads /
// country preference without re-running verification - notably including
// setting a country on a site that predates that field (see
// PublisherSite.country in schema.prisma).
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

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
