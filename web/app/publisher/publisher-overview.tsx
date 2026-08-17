"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Clock3, Globe2, LayoutGrid, Wallet as WalletIcon } from "lucide-react"

import { ApiError, getWalletSummary, listAdZones, listPublisherSites } from "@/lib/api"
import type { AdZoneStatus, PublisherWalletSummary } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { StatCard } from "@/components/app/stat-card"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  count: { label: "Ad zones", color: "var(--chart-2)" },
} satisfies ChartConfig

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
    setLoading(true)

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
  const chartData = ZONE_STATUSES.map((status) => ({
    status: status.charAt(0) + status.slice(1).toLowerCase(),
    count: zoneCounts[status],
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Available earnings"
          value={formatCurrency(summary?.availableEarnings ?? 0)}
          hint="Ready to withdraw"
          icon={WalletIcon}
          loading={loading}
        />
        <StatCard
          label="Pending earnings"
          value={formatCurrency(summary?.pendingEarnings ?? 0)}
          hint="Clearing before payout"
          icon={Clock3}
          loading={loading}
        />
        <StatCard
          label="Verified sites"
          value={String(verifiedSites)}
          hint="Ownership confirmed"
          icon={Globe2}
          loading={loading}
        />
        <StatCard
          label="Ad zones"
          value={String(totalZones)}
          hint={`${zoneCounts.ACTIVE} active`}
          icon={LayoutGrid}
          loading={loading}
        />
      </div>

      {!loading && totalZones > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ad zones by status</CardTitle>
            <CardDescription>
              How your inventory is distributed across active, paused, and
              archived zones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="status"
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
