"use client"

import { AdvertiserOverview } from "./advertiser-overview"

export default function AdvertiserPage() {
  return (
    <div className="space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your wallet and campaign performance at a glance.
        </p>
      </div>

      <AdvertiserOverview refreshToken={0} />
    </div>
  )
}
