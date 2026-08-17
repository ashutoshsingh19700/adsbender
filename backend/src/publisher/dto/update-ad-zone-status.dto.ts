import { IsEnum } from 'class-validator';
import { AdZoneStatus } from '@prisma/client';

// Used for enable/disable/archive - the service checks the current status
// and rejects the request if this move isn't allowed (see ad-zone-status.util.ts).
export class UpdateAdZoneStatusDto {
  @IsEnum(AdZoneStatus)
  status: AdZoneStatus;
}
