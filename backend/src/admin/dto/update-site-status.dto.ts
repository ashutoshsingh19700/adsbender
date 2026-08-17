import { IsEnum } from 'class-validator';
import { SiteStatus } from '@prisma/client';

// Admin cross-publisher moderation: unlike the publisher-facing
// UpdateSiteDto (publisher/dto/update-site.dto.ts) this isn't scoped to the
// owning publisher, so `status` is required rather than optional.
export class AdminUpdateSiteStatusDto {
  @IsEnum(SiteStatus)
  status: SiteStatus;
}
