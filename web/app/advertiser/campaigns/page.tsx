import { Suspense } from "react"

import { CampaignsPage } from "./campaigns-page"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CampaignsPage />
    </Suspense>
  )
}
