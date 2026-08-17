import { RequireRole } from "@/components/app/require-role"

import { PublisherDashboard } from "./publisher-dashboard"

export default function PublisherPage() {
  return (
    <RequireRole roles={["PUBLISHER"]}>
      <PublisherDashboard />
    </RequireRole>
  )
}
