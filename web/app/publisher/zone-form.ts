import { z } from "zod"

// Shared between the "create ad zone" form (publisher-dashboard.tsx) and the
// "edit ad zone" dialog (ad-zone-manager.tsx) so both stay in sync with the
// backend's CreateAdZoneDto / UpdateAdZoneDto field set.
export const LAYOUT_TYPES = [
  { value: "banner", label: "Banner" },
  { value: "sidebar", label: "Sidebar" },
  { value: "in-content", label: "In-content" },
  { value: "sticky-footer", label: "Sticky footer" },
] as const

export const zoneSchema = z.object({
  zoneName: z.string().min(2, "Zone name must be at least 2 characters"),
  width: z.coerce.number().int().min(1).max(4000),
  height: z.coerce.number().int().min(1).max(4000),
  layoutType: z.string().min(2, "Choose a layout type"),
})

export type ZoneFormInput = z.input<typeof zoneSchema>
export type ZoneFormOutput = z.output<typeof zoneSchema>
