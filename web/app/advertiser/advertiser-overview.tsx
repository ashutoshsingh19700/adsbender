"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { LayoutGrid, Rocket, Wallet2, Wallet as WalletIcon } from "lucide-react"

import { ApiError, getWalletSummary } from "@/lib/api"
import type { AdvertiserWalletSummary } from "@/lib/types"
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
  spent: { label: "Spent", color: "var(--chart-1)" },
  remaining: { label: "Remaining budget", color: "var(--chart-2)" },
} satisfies ChartConfig

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

  const chartData = liveCampaigns.map((c) => {
    // The API's `remaining` field is "unreserved portion of total budget"
    // (0 once a campaign is fully reserved on approval) — not spendable
    // headroom. What this chart needs is reserved-but-unspent: how much of
    // the locked-in budget is still available to spend before it runs out.
    const spent = Number(c.spent)
    const reserved = Number(c.reserved)
    return {
      name:
        c.campaignName.length > 14
          ? `${c.campaignName.slice(0, 13)}…`
          : c.campaignName,
      spent,
      remaining: Math.max(reserved - spent, 0),
    }
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Available balance"
          value={formatCurrency(summary?.availableBalance ?? 0)}
          hint="Free to reserve for new campaigns"
          icon={WalletIcon}
          loading={loading}
        />
        <StatCard
          label="Reserved budget"
          value={formatCurrency(summary?.reservedBalance ?? 0)}
          hint="Held against live campaigns"
          icon={Wallet2}
          loading={loading}
        />
        <StatCard
          label="Live campaigns"
          value={String(liveCampaigns.length)}
          hint="Active or paused"
          icon={Rocket}
          loading={loading}
        />
        <StatCard
          label="Total deposited"
          value={formatCurrency(summary?.totalDeposited ?? 0)}
          hint="Lifetime, all campaigns"
          icon={LayoutGrid}
          loading={loading}
        />
      </div>

      {!loading && chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Budget utilization</CardTitle>
            <CardDescription>
              Spent vs. remaining budget for each live campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="spent"
                  stackId="budget"
                  fill="var(--color-spent)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="remaining"
                  stackId="budget"
                  fill="var(--color-remaining)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
