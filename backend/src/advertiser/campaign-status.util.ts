import { CampaignStatus } from '@prisma/client';

// Campaign lifecycle:
//
//   DRAFT           -> PENDING_REVIEW, ARCHIVED
//   PENDING_REVIEW  -> ARCHIVED               (going ACTIVE is an admin
//                                               review decision, not covered
//                                               by these advertiser-facing
//                                               endpoints)
//   ACTIVE          -> PAUSED, COMPLETED
//   PAUSED          -> ACTIVE, ARCHIVED
//   COMPLETED       -> ARCHIVED
//   ARCHIVED        -> (nothing, it's terminal)
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [
    CampaignStatus.PENDING_REVIEW,
    CampaignStatus.ARCHIVED,
  ],
  [CampaignStatus.PENDING_REVIEW]: [CampaignStatus.ARCHIVED],
  [CampaignStatus.ACTIVE]: [CampaignStatus.PAUSED, CampaignStatus.COMPLETED],
  [CampaignStatus.PAUSED]: [CampaignStatus.ACTIVE, CampaignStatus.ARCHIVED],
  [CampaignStatus.COMPLETED]: [CampaignStatus.ARCHIVED],
  [CampaignStatus.ARCHIVED]: [],
};
