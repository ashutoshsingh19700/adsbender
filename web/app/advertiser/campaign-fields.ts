import { z } from "zod"

import { AD_FORMAT_CATALOG, AD_FORMAT_CATEGORIES } from "@/lib/ad-formats"

// Shared between the creation wizard (campaign-wizard.tsx) and the edit
// dialog (campaign-manager.tsx) so both stay in sync with the backend's
// CreateCampaignDto / UpdateCampaignDto field set and validation rules.
// lat/lng (country centroid, approximate) are used only by the globe
// visualization in campaign-wizard.tsx to place a marker per country.
export const COUNTRIES = [
  { value: "US", label: "United States", lat: 39.8, lng: -98.6 },
  { value: "IN", label: "India", lat: 22.9, lng: 78.7 },
  { value: "GB", label: "United Kingdom", lat: 54.0, lng: -2.9 },
  { value: "CA", label: "Canada", lat: 61.1, lng: -107.9 },
  { value: "AU", label: "Australia", lat: -25.3, lng: 133.8 },
  { value: "DE", label: "Germany", lat: 51.2, lng: 10.5 },
  { value: "FR", label: "France", lat: 46.6, lng: 2.2 },
  { value: "ES", label: "Spain", lat: 40.5, lng: -3.7 },
  { value: "IT", label: "Italy", lat: 41.9, lng: 12.6 },
  { value: "NL", label: "Netherlands", lat: 52.1, lng: 5.3 },
  { value: "BE", label: "Belgium", lat: 50.5, lng: 4.5 },
  { value: "PT", label: "Portugal", lat: 39.4, lng: -8.2 },
  { value: "IE", label: "Ireland", lat: 53.4, lng: -8.2 },
  { value: "CH", label: "Switzerland", lat: 46.8, lng: 8.2 },
  { value: "AT", label: "Austria", lat: 47.5, lng: 14.6 },
  { value: "SE", label: "Sweden", lat: 60.1, lng: 18.6 },
  { value: "NO", label: "Norway", lat: 60.5, lng: 8.5 },
  { value: "DK", label: "Denmark", lat: 56.3, lng: 9.5 },
  { value: "FI", label: "Finland", lat: 61.9, lng: 25.7 },
  { value: "PL", label: "Poland", lat: 51.9, lng: 19.1 },
  { value: "GR", label: "Greece", lat: 39.1, lng: 21.8 },
  { value: "RU", label: "Russia", lat: 61.5, lng: 105.3 },
  { value: "TR", label: "Turkey", lat: 38.9, lng: 35.2 },
  { value: "UA", label: "Ukraine", lat: 48.4, lng: 31.2 },
  { value: "BR", label: "Brazil", lat: -14.2, lng: -51.9 },
  { value: "MX", label: "Mexico", lat: 23.6, lng: -102.5 },
  { value: "AR", label: "Argentina", lat: -38.4, lng: -63.6 },
  { value: "CL", label: "Chile", lat: -35.7, lng: -71.5 },
  { value: "CO", label: "Colombia", lat: 4.6, lng: -74.3 },
  { value: "PE", label: "Peru", lat: -9.2, lng: -75.0 },
  { value: "JP", label: "Japan", lat: 36.2, lng: 138.3 },
  { value: "CN", label: "China", lat: 35.9, lng: 104.2 },
  { value: "KR", label: "South Korea", lat: 35.9, lng: 127.8 },
  { value: "SG", label: "Singapore", lat: 1.35, lng: 103.8 },
  { value: "ID", label: "Indonesia", lat: -0.8, lng: 113.9 },
  { value: "MY", label: "Malaysia", lat: 4.2, lng: 101.9 },
  { value: "PH", label: "Philippines", lat: 12.9, lng: 121.8 },
  { value: "TH", label: "Thailand", lat: 15.9, lng: 100.99 },
  { value: "VN", label: "Vietnam", lat: 14.1, lng: 108.3 },
  { value: "PK", label: "Pakistan", lat: 30.4, lng: 69.3 },
  { value: "BD", label: "Bangladesh", lat: 23.7, lng: 90.4 },
  { value: "AE", label: "United Arab Emirates", lat: 23.4, lng: 53.8 },
  { value: "SA", label: "Saudi Arabia", lat: 23.9, lng: 45.1 },
  { value: "IL", label: "Israel", lat: 31.0, lng: 34.8 },
  { value: "EG", label: "Egypt", lat: 26.8, lng: 30.8 },
  { value: "NG", label: "Nigeria", lat: 9.1, lng: 8.7 },
  { value: "ZA", label: "South Africa", lat: -30.6, lng: 22.9 },
  { value: "KE", label: "Kenya", lat: -0.02, lng: 37.9 },
  { value: "NZ", label: "New Zealand", lat: -40.9, lng: 174.9 },
]

export const DEVICES = [
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
]

export const OPERATING_SYSTEMS = [
  { value: "IOS", label: "iOS" },
  { value: "ANDROID", label: "Android" },
  { value: "WINDOWS", label: "Windows" },
  { value: "LINUX", label: "Linux" },
  { value: "OTHER", label: "Other" },
]

export const CONNECTION_TYPES = [
  { value: "WIFI", label: "Wi-Fi" },
  { value: "MOBILE_DATA", label: "Mobile Data" },
  { value: "ALL", label: "All Connections" },
] as const

// Mirrors CampaignAdFormat in schema.prisma. Stored on the campaign but not
// yet read by AdEngineController's serving logic - see the comment there.
// The three formats below (Social Bar, Native Banner, In-Page Push) predate
// the full catalog in lib/ad-formats.ts and are kept for backward
// compatibility with existing campaigns; every other format - including
// Popunder and Full Screen Interstitial, reused from this same legacy set -
// comes from the shared catalog so publisher inventory and advertiser
// targeting use the exact same format vocabulary.
export const LEGACY_AD_FORMATS = [
  { value: "SOCIAL_BAR", label: "Social Bar" },
  { value: "NATIVE_BANNER", label: "Native Banner" },
  { value: "IN_PAGE_PUSH", label: "In-Page Push" },
] as const

export const AD_FORMATS = [
  ...LEGACY_AD_FORMATS,
  ...AD_FORMAT_CATALOG.map((format) => ({
    value: format.value,
    label: format.label,
  })),
] as const

export const AD_FORMAT_VALUES = AD_FORMATS.map((f) => f.value) as [
  string,
  ...string[],
]

// Same formats as AD_FORMATS, grouped for the campaign wizard's categorized
// ad-unit picker (see AD_FORMAT_CATEGORIES / AD_FORMAT_CATALOG in
// lib/ad-formats.ts).
// FLOATING_SIDEBAR is dropped from the picker only - "Sticky Sidebar" and
// "Floating Sidebar" looked like the same option to advertisers, so the
// wizard now shows a single "Sidebar" tile (still using the STICKY_SIDEBAR
// value). The FLOATING_SIDEBAR enum value stays valid in AD_FORMATS/
// AD_FORMAT_VALUES and schema.prisma for any campaign that already uses it.
const PICKER_HIDDEN_AD_FORMATS = new Set(["FLOATING_SIDEBAR"])

export const GROUPED_AD_FORMATS = [
  { category: "Legacy" as const, formats: LEGACY_AD_FORMATS },
  ...AD_FORMAT_CATEGORIES.map((category) => ({
    category,
    formats: AD_FORMAT_CATALOG.filter(
      (f) => f.category === category && !PICKER_HIDDEN_AD_FORMATS.has(f.value)
    ).map((f) => ({
      value: f.value,
      label: f.value === "STICKY_SIDEBAR" ? "Sidebar" : f.label,
    })),
  })),
]

export const PRICING_MODELS = ["CPM", "CPA", "CPC"] as const

export const START_MODES = [
  { value: "START_ONCE_VERIFIED", label: "Start once verified" },
  { value: "SCHEDULE", label: "Schedule" },
  { value: "KEEP_INACTIVE", label: "Keep inactive" },
] as const

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
    // Optional refinements — narrow delivery further within the selected
    // devices/countries. Unlike targetDevices, an empty array here means
    // "no OS filter" rather than "select at least one".
    targetOperatingSystems: z.array(z.string()).default([]),
    connectionType: z
      .enum(["WIFI", "MOBILE_DATA", "ALL"])
      .default("ALL"),
    creativeType: z.enum(["image", "video", "html"]),
    creativeUrl: z.string().optional(),
    creativeHtml: z.string().optional(),
    // Required + auto-wrapped for creativeType "image" (AdEngineController
    // wraps the rendered <img> in a click-tracked link to this address).
    // Optional for "html" - stored for reference but never auto-wrapped,
    // since raw HTML often has its own <a>/<button>/<form> elements that an
    // outer anchor would break.
    destinationUrl: z.string().optional(),
    notes: z.string().optional(),

    // --- Adsterra-style setup fields - see schema.prisma / CreateCampaignDto ---
    adFormat: z.enum(AD_FORMAT_VALUES).optional(),
    pricingModel: z.enum(["CPM", "CPA", "CPC"]).default("CPM"),
    countryPricing: z.record(z.string(), z.coerce.number()).optional(),
    locations: z
      .array(
        z.object({
          country: z.string(),
          region: z.string().optional(),
          city: z.string().optional(),
          include: z.boolean(),
        })
      )
      .optional(),
    budgetUnlimited: z.boolean().default(false),
    startMode: z
      .enum(["START_ONCE_VERIFIED", "SCHEDULE", "KEEP_INACTIVE"])
      .default("START_ONCE_VERIFIED"),
    scheduledAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startMode === "SCHEDULE" && !data.scheduledAt) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "Pick a date and time to schedule this campaign",
      })
    }
    if (data.dailyBudget > data.totalBudget) {
      ctx.addIssue({
        code: "custom",
        path: ["dailyBudget"],
        message: "Daily budget cannot exceed total budget",
      })
    }
    if (
      (data.creativeType === "image" || data.creativeType === "video") &&
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
    if (data.creativeType === "image" || data.creativeType === "video") {
      if (!data.destinationUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationUrl"],
          message: "Destination URL is required so the ad is clickable",
        })
      } else if (!isValidHttpUrl(data.destinationUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationUrl"],
          message: "Enter a valid URL, starting with https:// or http://",
        })
      }
      // "html" creatives leave destinationUrl optional (embed their own
      // links in the raw markup) but it's still format-checked if given.
    } else if (data.destinationUrl && !isValidHttpUrl(data.destinationUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["destinationUrl"],
        message: "Enter a valid URL, starting with https:// or http://",
      })
    }
  })

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

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
