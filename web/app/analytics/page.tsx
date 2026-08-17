import { RequireRole } from "@/components/app/require-role"

import { AnalyticsDashboard } from "./analytics-dashboard"

export default function AnalyticsPage() {
  return (
    <RequireRole roles={["ADVERTISER", "PUBLISHER", "ADMIN"]}>
      <AnalyticsDashboard />
    </RequireRole>
  )
}
