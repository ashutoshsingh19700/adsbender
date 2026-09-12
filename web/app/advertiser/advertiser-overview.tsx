"use client"

import * as React from "react"
import { toast } from "sonner"

import { ApiError, getWalletSummary } from "@/lib/api"
import type { AdvertiserWalletSummary } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { StatCard } from "@/components/app/stat-card"

// Advertiser Studio's at-a-glance header: wallet + campaign totals sourced
// from the advertiser's own wallet summary only — never platform-wide
// figures, and never rendered anywhere a non-advertiser (or a signed-out
// visitor) could see it.
export function AdvertiserOverview({ refreshToken }: { refreshToken: number }) {
  const [summary, setSummary] = React.useState<AdvertiserWalletSummary | null>(
    null
  )
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    getWalletSummary()
      .then((data) => {
        if (!cancelled) setSummary(data as AdvertiserWalletSummary)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof ApiError ? error.message : "Could not load wallet"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const liveCampaigns =
    summary?.campaignSpending.filter(
      (c) => c.status === "ACTIVE" || c.status === "PAUSED"
    ) ?? []

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <StatCard
        label="Available balance"
        value={formatCurrency(summary?.availableBalance ?? 0)}
        hint="Free to reserve for new campaigns"
        loading={loading}
      />
      <StatCard
        label="Reserved budget"
        value={formatCurrency(summary?.reservedBalance ?? 0)}
        hint="Held against live campaigns"
        loading={loading}
      />
      <StatCard
        label="Live campaigns"
        value={String(liveCampaigns.length)}
        hint="Active or paused"
        loading={loading}
      />
      <StatCard
        label="Total deposited"
        value={formatCurrency(summary?.totalDeposited ?? 0)}
        hint="Lifetime, all campaigns"
        loading={loading}
      />
    </div>
  )
}
