import { RequireRole } from "@/components/app/require-role"

import { WebsitesPage } from "./websites-page"

export default function PublisherWebsitesPage() {
  return (
    <RequireRole roles={["PUBLISHER"]}>
      <WebsitesPage />
    </RequireRole>
  )
}
