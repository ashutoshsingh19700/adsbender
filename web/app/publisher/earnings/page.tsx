import { RequireRole } from "@/components/app/require-role"

import { PublisherEarningsPage } from "./earnings-page"

export default function Page() {
  return (
    <RequireRole roles={["PUBLISHER"]}>
      <PublisherEarningsPage />
    </RequireRole>
  )
}
