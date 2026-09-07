"use client"

import { adminGetTrafficQuality } from "@/lib/api"
import { TrafficQualityPanel as SharedTrafficQualityPanel } from "@/components/app/traffic-quality-panel"

// Platform-wide (every publisher's zones, every advertiser's campaigns) -
// see AdminService.getTrafficQuality. The publisher/advertiser dashboards
// each get their own scoped view of the same underlying data.
export function AdminTrafficQualityPanel() {
  return (
    <SharedTrafficQualityPanel
      description="Bot and fraud traffic blocked or flagged across every publisher and advertiser on the platform."
      fetchTrafficQuality={adminGetTrafficQuality}
    />
  )
}
