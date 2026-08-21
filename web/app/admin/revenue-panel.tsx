"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Banknote, Clock, TrendingUp, Wallet } from "lucide-react"

import { adminGetRevenueSummary, ApiError, getDailyAnalytics } from "@/lib/api"
import type { AnalyticsResponse, RevenueSummary } from "@/lib/types"
import { defaultDateRange, formatCurrency } from "@/lib/utils"
import { StatCard } from "@/components/app/stat-card"
import { Button } from "@/components/ui/button"
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

const chartConfig = {
  spend: { label: "Advertiser spend", color: "var(--chart-1)" },
  payout: { label: "Publisher payout", color: "var(--chart-2)" },
  margin: { label: "Platform revenue", color: "var(--chart-4)" },
} satisfies ChartConfig

// Platform-wide margin over time: the same 70/30 split baked into
// ClickHouseAnalyticsQueryStore (payout = spend * 0.7), shown as the
// difference so admins can see the take, not just the two inputs.
export function RevenuePanel() {
  const [range, setRange] = React.useState(defaultDateRange)
  const [trend, setTrend] = React.useState<AnalyticsResponse | null>(null)
  const [summary, setSummary] = React.useState<RevenueSummary | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadTrend = React.useCallback(
    async (startDate: string, endDate: string) => {
      setLoading(true)
      try {
        const response = await getDailyAnalytics(startDate, endDate)
        setTrend(response)
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Could not load revenue trend"
        )
      } finally {
        setLoading(false)
      }
    },
    []
  )

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTrend(range.startDate, range.endDate)

    adminGetRevenueSummary()
      .then((s) => setSummary(s))
      .catch((error) => {
        toast.error(
          error instanceof ApiError ? error.message : "Could not load revenue summary"
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chartData = trend?.rows.map((row) => ({
    date: row.date,
    spend: Number(row.spend.toFixed(2)),
    payout: Number(row.payout.toFixed(2)),
    margin: Number((row.spend - row.payout).toFixed(2)),
  }))

  const periodMargin = trend
    ? trend.totals.spend - trend.totals.payout
    : undefined

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Platform revenue"
          value={
            summary ? formatCurrency(summary.platformRevenue) : "—"
          }
          hint="Lifetime, all campaigns"
          icon={TrendingUp}
          loading={!summary}
          tone="positive"
        />
        <StatCard
          label="Advertiser spend"
          value={summary ? formatCurrency(summary.totalAdSpend) : "—"}
          hint="Total billed to advertisers"
          icon={Banknote}
          loading={!summary}
        />
        <StatCard
          label="Publisher liability"
          value={
            summary
              ? formatCurrency(summary.outstandingPublisherLiability)
              : "—"
          }
          hint="Earned, not yet withdrawn"
          icon={Wallet}
          loading={!summary}
        />
        <StatCard
          label="Pending payouts"
          value={summary ? formatCurrency(summary.pendingPayoutAmount) : "—"}
          hint={
            summary
              ? `${summary.pendingPayoutCount} awaiting processing`
              : undefined
          }
          icon={Clock}
          loading={!summary}
          tone={summary && summary.pendingPayoutCount > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="revenue-start">Start date</Label>
            <Input
              id="revenue-start"
              type="date"
              value={range.startDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, startDate: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="revenue-end">End date</Label>
            <Input
              id="revenue-end"
              type="date"
              value={range.endDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, endDate: e.target.value }))
              }
            />
          </div>
          <Button
            onClick={() => loadTrend(range.startDate, range.endDate)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          {periodMargin !== undefined ? (
            <p className="ml-auto text-sm text-muted-foreground">
              Margin for this period:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(periodMargin)}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend vs. payout</CardTitle>
          <CardDescription>
            Platform-wide, across every advertiser and publisher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !trend ? (
            <Skeleton className="h-80 w-full" />
          ) : chartData && chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  dataKey="spend"
                  stroke="var(--color-spend)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="payout"
                  stroke="var(--color-payout)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="margin"
                  stroke="var(--color-margin)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No data for this date range.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
