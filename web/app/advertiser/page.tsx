"use client"

import { AdvertiserOverview } from "./advertiser-overview"
import { StatisticsPage } from "./statistics/statistics-page"

export default function AdvertiserPage() {
  return (
    <div className="space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <AdvertiserOverview refreshToken={0} />

      <StatisticsPage embedded />
    </div>
  )
}
