"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Globe2, Megaphone, ShieldAlert, Users } from "lucide-react"

import {
  adminListCampaigns,
  adminListSites,
  adminListUsers,
  ApiError,
} from "@/lib/api"
import type { CampaignStatus } from "@/lib/types"
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
  count: { label: "Campaigns", color: "var(--chart-1)" },
} satisfies ChartConfig

const STATUSES: CampaignStatus[] = [
  "PENDING_REVIEW",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]

// Platform-wide oversight numbers - this is the one dashboard where
// aggregate figures across every advertiser/publisher are appropriate,
// because only ADMIN-role accounts ever reach this page (see
// <RequireRole> in admin/page.tsx and the role-filtered nav in
// site-header.tsx).
export function AdminOverview({ refreshToken }: { refreshToken: number }) {
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
      Promise.all(
        STATUSES.map((status) =>
          adminListCampaigns({ status, pageSize: 1 }).then((r) => [status, r.total] as const)
        )
      ),
      adminListUsers({ pageSize: 1 }),
      adminListSites({ pageSize: 1 }),
    ])
      .then(([statusPairs, users, sites]) => {
        if (cancelled) return
        setCounts(Object.fromEntries(statusPairs) as Record<CampaignStatus, number>)
        setUserCount(users.total)
        setSiteCount(sites.total)
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
  }, [refreshToken])

  const chartData = STATUSES.map((status) => ({
    status: status.replace("_", " "),
    count: counts?.[status] ?? 0,
  }))
  const hasCampaigns = chartData.some((d) => d.count > 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Pending review"
          value={String(counts?.PENDING_REVIEW ?? 0)}
          hint="Awaiting a decision"
          icon={ShieldAlert}
          loading={loading}
          tone={counts && counts.PENDING_REVIEW > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Active campaigns"
          value={String(counts?.ACTIVE ?? 0)}
          hint="Live on the platform"
          icon={Megaphone}
          loading={loading}
        />
        <StatCard
          label="Users"
          value={String(userCount)}
          hint="Advertisers, publishers & admins"
          icon={Users}
          loading={loading}
        />
        <StatCard
          label="Sites"
          value={String(siteCount)}
          hint="Registered by publishers"
          icon={Globe2}
          loading={loading}
        />
      </div>

      {!loading && hasCampaigns ? (
        <Card>
          <CardHeader>
            <CardTitle>Campaigns by status</CardTitle>
            <CardDescription>
              Platform-wide distribution across the review pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-56 w-full">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="status"
                  tickLine={false}
                  axisLine={false}
                  width={110}
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
