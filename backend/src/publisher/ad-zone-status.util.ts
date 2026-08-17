import { AdZoneStatus } from '@prisma/client';

// Ad-zone lifecycle: CREATED zones start ACTIVE (they can serve ads right
// away), then can be paused/resumed, and archived as a final, permanent stop.
//
//   ACTIVE   -> PAUSED, ARCHIVED
//   PAUSED   -> ACTIVE, ARCHIVED
//   ARCHIVED -> (nothing, it's terminal)
export const AD_ZONE_TRANSITIONS: Record<AdZoneStatus, AdZoneStatus[]> = {
  [AdZoneStatus.ACTIVE]: [AdZoneStatus.PAUSED, AdZoneStatus.ARCHIVED],
  [AdZoneStatus.PAUSED]: [AdZoneStatus.ACTIVE, AdZoneStatus.ARCHIVED],
  [AdZoneStatus.ARCHIVED]: [],
};
