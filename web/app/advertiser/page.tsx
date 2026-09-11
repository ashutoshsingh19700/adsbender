"use client"

import { AdvertiserOverview } from "./advertiser-overview"

export default function AdvertiserPage() {
  return (
    <div className="space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <AdvertiserOverview refreshToken={0} />
    </div>
  )
}
