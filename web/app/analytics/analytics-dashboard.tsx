"use client"

import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import { ApiError, getDailyAnalytics } from "@/lib/api"
import type { AnalyticsResponse } from "@/lib/types"
import { defaultDateRange } from "@/lib/utils"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const chartConfig = {
  impressions: { label: "Impressions", color: "var(--chart-1)" },
  clicks: { label: "Clicks", color: "var(--chart-2)" },
  ctr: { label: "CTR %", color: "var(--chart-3)" },
  payout: { label: "Payout $", color: "var(--chart-4)" },
} satisfies ChartConfig

export function AnalyticsDashboard() {
  const [range, setRange] = React.useState(defaultDateRange)
  const [data, setData] = React.useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadMetrics = React.useCallback(async (startDate: string, endDate: string) => {
    setLoading(true)
    try {
      const response = await getDailyAnalytics(startDate, endDate)
      setData(response)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load analytics"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // Loads the default date range once on mount; subsequent loads are
    // user-triggered via the Refresh button, not driven by `range` changing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMetrics(range.startDate, range.endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = data?.totals
  const chartData = data?.rows.map((row) => ({
    date: row.date,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: Number((row.ctr * 100).toFixed(2)),
    payout: Number(row.payout.toFixed(2)),
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Impressions, clicks, spend, and payout over time.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={range.startDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, startDate: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              value={range.endDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, endDate: e.target.value }))
              }
            />
          </div>
          <Button
            onClick={() => loadMetrics(range.startDate, range.endDate)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-5">
          <SummaryTile label="Impressions" value={totals?.impressions ?? 0} />
          <SummaryTile label="Clicks" value={totals?.clicks ?? 0} />
          <SummaryTile
            label="CTR"
            value={`${((totals?.ctr ?? 0) * 100).toFixed(2)}%`}
          />
          <SummaryTile
            label="Spend"
            value={`$${(totals?.spend ?? 0).toFixed(2)}`}
          />
          <SummaryTile
            label="Payout"
            value={`$${(totals?.payout ?? 0).toFixed(2)}`}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daily trend</CardTitle>
          <CardDescription>
            Impressions/clicks on the left axis, CTR%/payout on the right.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData && chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  yAxisId="left"
                  dataKey="impressions"
                  stroke="var(--color-impressions)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  dataKey="clicks"
                  stroke="var(--color-clicks)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="ctr"
                  stroke="var(--color-ctr)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="payout"
                  stroke="var(--color-payout)"
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

      <Card>
        <CardHeader>
          <CardTitle>Daily breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rows.length ? (
                data.rows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell className="text-right">
                      {row.impressions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.clicks.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.ctr * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      ${row.spend.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${row.payout.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No rows for this date range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryTile({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
