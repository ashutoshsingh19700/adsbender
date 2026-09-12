"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  adminListCampaigns,
  adminListSites,
  adminListUsers,
  ApiError,
} from "@/lib/api"
import type { CampaignStatus } from "@/lib/types"
import { StatCard } from "@/components/app/stat-card"

const STATUSES: CampaignStatus[] = [
  "PENDING_REVIEW",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]

// Platform-wide oversight numbers - only ADMIN-role accounts ever reach
// this page (see <RequireRole> in admin/page.tsx), but a PUBLISHER- or
// ADVERTISER-scoped admin can't call every endpoint this used to fetch
// unconditionally (see AdminScopeGuard) - campaigns is advertiser-side,
// sites is publisher-side. `scope` lets each card fetch only what that
// admin can actually see, instead of one Promise.all where a single 403
// used to blank out every card.
export function AdminOverview({
  refreshToken,
  scope,
}: {
  refreshToken: number
  scope: "MASTER" | "PUBLISHER" | "ADVERTISER"
}) {
  const canSeeCampaigns = scope === "MASTER" || scope === "ADVERTISER"
  const canSeeSites = scope === "MASTER" || scope === "PUBLISHER"

  const [counts, setCounts] = React.useState<Record<CampaignStatus, number> | null>(
    null
  )
  const [userCount, setUserCount] = React.useState(0)
  const [siteCount, setSiteCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      canSeeCampaigns
        ? Promise.all(
            STATUSES.map((status) =>
              adminListCampaigns({ status, pageSize: 1 }).then(
                (r) => [status, r.total] as const
              )
            )
          )
        : Promise.resolve(null),
      adminListUsers({ pageSize: 1 }),
      canSeeSites ? adminListSites({ pageSize: 1 }) : Promise.resolve(null),
    ])
      .then(([statusPairs, users, sites]) => {
        if (cancelled) return
        if (statusPairs) {
          setCounts(Object.fromEntries(statusPairs) as Record<CampaignStatus, number>)
        }
        setUserCount(users.total)
        if (sites) setSiteCount(sites.total)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Could not load platform overview"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshToken, canSeeCampaigns, canSeeSites])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        {canSeeCampaigns ? (
          <StatCard
            label="Pending review"
            value={String(counts?.PENDING_REVIEW ?? 0)}
            hint="Awaiting a decision"
            loading={loading}
            tone={counts && counts.PENDING_REVIEW > 0 ? "warning" : "default"}
          />
        ) : null}
        {canSeeCampaigns ? (
          <StatCard
            label="Active campaigns"
            value={String(counts?.ACTIVE ?? 0)}
            hint="Live on the platform"
            loading={loading}
          />
        ) : null}
        <StatCard
          label="Users"
          value={String(userCount)}
          hint="Advertisers, publishers & admins"
          loading={loading}
        />
        {canSeeSites ? (
          <StatCard
            label="Sites"
            value={String(siteCount)}
            hint="Registered by publishers"
            loading={loading}
          />
        ) : null}
      </div>
    </div>
  )
}
