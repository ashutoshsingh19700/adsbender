import { RequireRole } from "@/components/app/require-role"

import { PublisherStatisticsPage } from "./statistics-page"

export default function Page() {
  return (
    <RequireRole roles={["PUBLISHER"]}>
      <PublisherStatisticsPage />
    </RequireRole>
  )
}
