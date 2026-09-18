import { z } from "zod"

import { AD_CATEGORIES } from "@/lib/ad-categories"
import {
  AD_FORMAT_CATALOG,
  AD_FORMAT_CATEGORIES,
  CORE_AD_FORMAT_VALUES,
} from "@/lib/ad-formats"

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

// Same data, grouped for a categorized select UI. Trimmed to the "core"
// formats (see CORE_AD_FORMAT_VALUES in lib/ad-formats.ts) that actually
// drive most ad-network revenue, mirroring the same trim on the advertiser
// side (campaign-fields.ts's GROUPED_AD_FORMATS) so a publisher's zone
// options line up with what advertisers can actually target. The rest of
// the catalog is effectively "commented out" of the picker via this filter -
// the values stay valid in LAYOUT_TYPES/schema for any zone that already
// uses them.
export const GROUPED_LAYOUT_TYPES = [
  { category: "Legacy" as const, formats: LEGACY_LAYOUT_TYPES },
  ...AD_FORMAT_CATEGORIES.map((category) => ({
    category,
    formats: AD_FORMAT_CATALOG.filter(
      (f) => f.category === category && CORE_AD_FORMAT_VALUES.has(f.value)
    ),
  })).filter((group) => group.formats.length > 0),
]

// Options for the zone form's "Allowed ad categories" multi-select - leaving
// this empty means the zone accepts any category (see
// AdTargetingService.isEligible on the backend).
export const AD_CATEGORY_OPTIONS = AD_CATEGORIES.map((category) => ({
  value: category,
  label: category,
}))

export const zoneSchema = z.object({
  zoneName: z.string().min(2, "Zone name must be at least 2 characters"),
  width: z.coerce.number().int().min(1).max(4000),
  height: z.coerce.number().int().min(1).max(4000),
  layoutType: z.string().min(2, "Choose a layout type"),
  // Optional - restricts this zone to serving only campaigns tagged with one
  // of these categories. Empty/omitted means no restriction.
  allowedCategories: z.array(z.string()).default([]),
})

export type ZoneFormInput = z.input<typeof zoneSchema>
export type ZoneFormOutput = z.output<typeof zoneSchema>
