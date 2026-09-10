"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { ShieldAlert, ShieldBan, ShieldCheck } from "lucide-react"

import { ApiError } from "@/lib/api"
import type { TrafficQualityResponse } from "@/lib/types"
import { defaultDateRange } from "@/lib/utils"
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
  blocked: { label: "Blocked (never billed)", color: "#f97a24" },
  flagged: { label: "Flagged (allowed, monitored)", color: "#4a6ef5" },
} satisfies ChartConfig

// Human-readable label for each machine-readable reason code -
// FraudDetectionService / ClickIntegrityService / DatacenterIpService.
const REASON_LABELS: Record<string, string> = {
  IP_BLACKLISTED: "IP address blacklisted",
  MISSING_USER_AGENT: "Missing User-Agent header",
  SUSPICIOUS_USER_AGENT: "Automation tool user agent (curl, headless, ...)",
  IMPRESSION_VELOCITY_EXCEEDED: "Too many impressions from one IP",
  CLICK_VELOCITY_EXCEEDED: "Too many clicks from one IP",
  MISSING_CLICK_TOKEN: "Click had no ad-impression proof (direct hit)",
  MALFORMED_CLICK_TOKEN: "Click proof was malformed",
  CLICK_TOKEN_SIGNATURE_MISMATCH: "Click proof signature invalid",
  CLICK_TOKEN_SCOPE_MISMATCH: "Click proof for a different ad/zone",
  CLICK_TOKEN_EXPIRED: "Click too fast or too old to be human",
  DATACENTER_IP: "Traffic from a cloud/hosting IP",
  DATACENTER_IP_CLICK: "Click from a cloud/hosting IP",
}

function reasonLabel(reason: string) {
  return REASON_LABELS[reason] ?? reason
}

// Shared "Traffic Quality" panel used on the Admin, Publisher, and
// Advertiser dashboards - each just supplies its own scoped fetcher (see
// getPublisherTrafficQuality / getAdvertiserTrafficQuality /
// adminGetTrafficQuality in lib/api.ts). Shows how much traffic
// FraudDetectionService blocked (never billed) or flagged (allowed, but
// recorded as suspicious) over a date range.
export function TrafficQualityPanel({
  fetchTrafficQuality,
  description,
}: {
  fetchTrafficQuality: (params: {
    startDate: string
    endDate: string
  }) => Promise<TrafficQualityResponse>
  description: string
}) {
  const [range, setRange] = React.useState(defaultDateRange)
  const [data, setData] = React.useState<TrafficQualityResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(
    async (startDate: string, endDate: string) => {
      setLoading(true)
      try {
        const response = await fetchTrafficQuality({ startDate, endDate })
        setData(response)
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not load traffic quality data"
        )
      } finally {
        setLoading(false)
      }
    },
    [fetchTrafficQuality]
  )

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(range.startDate, range.endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalSuspicious = data ? data.totalBlocked + data.totalFlagged : 0
  const chartData = data?.byDate.map((row) => ({
    date: row.date,
    blocked: row.blocked,
    flagged: row.flagged,
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Blocked traffic"
          value={data ? data.totalBlocked.toLocaleString() : "—"}
          hint="Never served an ad or tracked a click - not billed"
          icon={ShieldBan}
          loading={!data}
          tone={data && data.totalBlocked > 0 ? "warning" : "positive"}
        />
        <StatCard
          label="Flagged traffic"
          value={data ? data.totalFlagged.toLocaleString() : "—"}
          hint="Allowed through, recorded as suspicious"
          icon={ShieldAlert}
          loading={!data}
        />
        <StatCard
          label="Total suspicious"
          value={data ? totalSuspicious.toLocaleString() : "—"}
          hint="Blocked + flagged for this period"
          icon={ShieldCheck}
          loading={!data}
          tone="positive"
        />
      </div>

      <Card className="rounded-2xl border-none py-0 shadow-sm ring-1 ring-border">
        <CardContent className="flex flex-wrap items-end gap-4 py-5">
          <div className="grid gap-1.5">
            <Label
              htmlFor="traffic-quality-start"
              className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              Start date
            </Label>
            <Input
              id="traffic-quality-start"
              type="date"
              className="rounded-lg"
              value={range.startDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, startDate: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="traffic-quality-end"
              className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              End date
            </Label>
            <Input
              id="traffic-quality-end"
              type="date"
              className="rounded-lg"
              value={range.endDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, endDate: e.target.value }))
              }
            />
          </div>
          <Button
            onClick={() => load(range.startDate, range.endDate)}
            disabled={loading}
            className="brand-gradient rounded-lg border-0 font-semibold text-white"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none py-0 shadow-sm ring-1 ring-border">
        <CardHeader className="pt-6">
          <CardTitle className="text-base font-bold">
            Blocked vs. flagged over time
          </CardTitle>
          <CardDescription>
            Every bot/fraud decision recorded during ad serving and clicks.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          {loading && !data ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData && chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="blocked" fill="var(--color-blocked)" radius={4} />
                <Bar dataKey="flagged" fill="var(--color-flagged)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No blocked or flagged traffic for this date range.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none py-0 shadow-sm ring-1 ring-border">
        <CardHeader className="pt-6">
          <CardTitle className="text-base font-bold">Breakdown by reason</CardTitle>
          <CardDescription>
            What triggered each block/flag - see the ad-engine&apos;s fraud
            detection for how each check works.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          {loading && !data ? (
            <Skeleton className="h-40 w-full" />
          ) : data && data.byReason.length > 0 ? (
            <div className="flex flex-col gap-4">
              {data.byReason.map((row) => {
                const rowTotal = row.blocked + row.flagged
                const maxTotal = Math.max(
                  ...data.byReason.map((r) => r.blocked + r.flagged),
                  1
                )
                const pct = (rowTotal / maxTotal) * 100
                return (
                  <div key={`${row.stage}:${row.reason}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="font-semibold">
                        {reasonLabel(row.reason)}{" "}
                        <span className="font-normal text-muted-foreground capitalize">
                          · {row.stage}
                        </span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.blocked.toLocaleString()} blocked ·{" "}
                        {row.flagged.toLocaleString()} flagged
                      </span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="h-full bg-[#f97a24]"
                        style={{
                          width: `${rowTotal > 0 ? (row.blocked / maxTotal) * 100 : 0}%`,
                        }}
                      />
                      <span
                        className="h-full bg-[#4a6ef5]"
                        style={{
                          width: `${rowTotal > 0 ? (row.flagged / maxTotal) * 100 : 0}%`,
                        }}
                      />
                      <span
                        className="h-full"
                        style={{ width: `${100 - pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing to report for this date range.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
