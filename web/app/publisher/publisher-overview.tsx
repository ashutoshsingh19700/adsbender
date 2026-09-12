"use client"

import * as React from "react"
import { toast } from "sonner"

import { ApiError, getWalletSummary, listAdZones, listPublisherSites } from "@/lib/api"
import type { AdZoneStatus, PublisherWalletSummary } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { StatCard } from "@/components/app/stat-card"

const ZONE_STATUSES: AdZoneStatus[] = ["ACTIVE", "PAUSED", "ARCHIVED"]

// Publisher Portal's at-a-glance header: this publisher's own earnings and
// site/zone counts only — sourced from their wallet summary, never a
// platform-wide figure.
export function PublisherOverview({ refreshToken }: { refreshToken: number }) {
  const [summary, setSummary] = React.useState<PublisherWalletSummary | null>(
    null
  )
  const [verifiedSites, setVerifiedSites] = React.useState(0)
  const [zoneCounts, setZoneCounts] = React.useState<Record<AdZoneStatus, number>>(
    { ACTIVE: 0, PAUSED: 0, ARCHIVED: 0 }
  )
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    // Deliberately doesn't reset `loading` to true here: refreshToken bumps
    // on every zone/site mutation, and resetting to the skeleton on each of
    // those would flash the whole overview blank for a refetch that's
    // usually near-instant. The initial `useState(true)` above covers first
    // mount; after that, stale numbers stay on screen until the new ones
    // land instead of flickering out.
    Promise.all([
      getWalletSummary(),
      listPublisherSites({ pageSize: 100 }),
      listAdZones({ pageSize: 100 }),
    ])
      .then(([wallet, sites, zones]) => {
        if (cancelled) return
        setSummary(wallet as PublisherWalletSummary)
        setVerifiedSites(sites.sites.filter((s) => s.verified).length)
        setZoneCounts(
          zones.zones.reduce(
            (acc, z) => {
              acc[z.status] = (acc[z.status] ?? 0) + 1
              return acc
            },
            { ACTIVE: 0, PAUSED: 0, ARCHIVED: 0 } as Record<AdZoneStatus, number>
          )
        )
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Could not load account overview"
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

  const totalZones = ZONE_STATUSES.reduce((sum, s) => sum + zoneCounts[s], 0)

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <StatCard
        label="Available earnings"
        value={formatCurrency(summary?.availableEarnings ?? 0)}
        hint="Ready to withdraw"
        loading={loading}
      />
      <StatCard
        label="Pending earnings"
        value={formatCurrency(summary?.pendingEarnings ?? 0)}
        hint="Clearing before payout"
        loading={loading}
      />
      <StatCard
        label="Verified sites"
        value={String(verifiedSites)}
        hint="Ownership confirmed"
        loading={loading}
      />
      <StatCard
        label="Ad zones"
        value={String(totalZones)}
        hint={`${zoneCounts.ACTIVE} active`}
        loading={loading}
      />
    </div>
  )
}
