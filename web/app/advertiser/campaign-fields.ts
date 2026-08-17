import { z } from "zod"

// Shared between the creation wizard (campaign-wizard.tsx) and the edit
// dialog (campaign-manager.tsx) so both stay in sync with the backend's
// CreateCampaignDto / UpdateCampaignDto field set and validation rules.
export const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "IN", label: "India" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
]

export const DEVICES = [
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
]

export const campaignSchema = z
  .object({
    campaignName: z
      .string()
      .min(2, "Campaign name must be at least 2 characters")
      .max(120, "Campaign name must be under 120 characters"),
    totalBudget: z.coerce.number().min(1, "Total budget must be at least 1"),
    dailyBudget: z.coerce.number().min(1, "Daily budget must be at least 1"),
    maxCpc: z.coerce.number().min(0.01, "Max CPC must be at least 0.01"),
    targetCountries: z
      .array(z.string())
      .min(1, "Select at least one country"),
    targetDevices: z.array(z.string()).min(1, "Select at least one device"),
    creativeType: z.enum(["image", "html"]),
    creativeUrl: z.string().optional(),
    creativeHtml: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dailyBudget > data.totalBudget) {
      ctx.addIssue({
        code: "custom",
        path: ["dailyBudget"],
        message: "Daily budget cannot exceed total budget",
      })
    }
    if (
      data.creativeType === "image" &&
      (!data.creativeUrl || data.creativeUrl.length < 8)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["creativeUrl"],
        message: "Creative URL is required (min 8 characters)",
      })
    }
    if (
      data.creativeType === "html" &&
      (!data.creativeHtml || data.creativeHtml.length < 8)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["creativeHtml"],
        message: "Creative HTML is required (min 8 characters)",
      })
    }
  })

export type CampaignFormInput = z.input<typeof campaignSchema>
export type CampaignFormOutput = z.output<typeof campaignSchema>

// Campaigns can only be edited while DRAFT or PAUSED - mirrors
// EDITABLE_STATUSES in backend/src/advertiser/advertiser.service.ts.
export const EDITABLE_CAMPAIGN_STATUSES = ["DRAFT", "PAUSED"] as const

// Only a campaign that never went through review (DRAFT) can be deleted -
// mirrors AdvertiserService#deleteCampaign.
export const DELETABLE_CAMPAIGN_STATUSES = ["DRAFT"] as const

// Mirrors CAMPAIGN_TRANSITIONS in
// backend/src/advertiser/campaign-status.util.ts - which statuses can move
// to ARCHIVED. Notably ACTIVE campaigns must be paused first.
export const ARCHIVABLE_CAMPAIGN_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PAUSED",
  "COMPLETED",
] as const
