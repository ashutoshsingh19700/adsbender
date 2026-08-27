import { z } from "zod"

import { AD_FORMAT_CATALOG, AD_FORMAT_CATEGORIES } from "@/lib/ad-formats"

// Shared between the "create ad zone" form (publisher-dashboard.tsx) and the
// "edit ad zone" dialog (ad-zone-manager.tsx) so both stay in sync with the
// backend's CreateAdZoneDto / UpdateAdZoneDto field set.
//
// The four original layouts are kept at the top for backward compatibility -
// existing ad zones already stored with these values keep working and stay
// selectable. Every format from AD_FORMAT_CATALOG (banner, sidebar, native,
// popup, interstitial, video and premium inventory) is appended after them,
// grouped by category - see lib/ad-formats.ts for the single source of truth
// shared with the advertiser's campaign wizard.
export const LEGACY_LAYOUT_TYPES = [
  { value: "banner", label: "Banner" },
  { value: "sidebar", label: "Sidebar" },
  { value: "in-content", label: "In-content" },
  { value: "sticky-footer", label: "Sticky footer" },
] as const

export const LAYOUT_TYPES = [
  ...LEGACY_LAYOUT_TYPES,
  ...AD_FORMAT_CATALOG.map((format) => ({
    value: format.value,
    label: format.label,
  })),
]

// Same data, grouped for a categorized select UI.
export const GROUPED_LAYOUT_TYPES = [
  { category: "Legacy" as const, formats: LEGACY_LAYOUT_TYPES },
  ...AD_FORMAT_CATEGORIES.map((category) => ({
    category,
    formats: AD_FORMAT_CATALOG.filter((f) => f.category === category),
  })),
]

export const zoneSchema = z.object({
  zoneName: z.string().min(2, "Zone name must be at least 2 characters"),
  width: z.coerce.number().int().min(1).max(4000),
  height: z.coerce.number().int().min(1).max(4000),
  layoutType: z.string().min(2, "Choose a layout type"),
})

export type ZoneFormInput = z.input<typeof zoneSchema>
export type ZoneFormOutput = z.output<typeof zoneSchema>
