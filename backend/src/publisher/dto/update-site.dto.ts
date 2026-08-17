import { IsEnum, IsOptional } from 'class-validator';
import { SiteStatus } from '@prisma/client';

// A publisher site's identity (domain, verification) is set by the
// domains/validate flow. The only thing this endpoint lets you change
// afterwards is whether the site is active or deactivated.
export class UpdateSiteDto {
  @IsOptional()
  @IsEnum(SiteStatus)
  status?: SiteStatus;
}
