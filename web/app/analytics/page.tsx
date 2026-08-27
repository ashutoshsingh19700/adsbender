import type { Metadata } from "next"

import { RequireRole } from "@/components/app/require-role"

import { AnalyticsDashboard } from "./analytics-dashboard"

// Authenticated dashboard — never a search result (also disallowed in
// robots.ts, and proxy.ts 307s signed-out visitors to /login before this
// ever renders for them).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AnalyticsPage() {
  return (
    <RequireRole roles={["ADVERTISER", "PUBLISHER", "ADMIN"]}>
      <AnalyticsDashboard />
    </RequireRole>
  )
}
