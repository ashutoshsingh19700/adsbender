import { RequireRole } from "@/components/app/require-role"

import { AdminDashboard } from "./admin-dashboard"

export default function AdminPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <AdminDashboard />
    </RequireRole>
  )
}
