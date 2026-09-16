"use client"

import * as React from "react"
import { toast } from "sonner"
import { Eye, MousePointerClick, Wallet } from "lucide-react"

import {
  ApiError,
  getAdvertiserTrafficQuality,
  getCampaignsPerformance,
  listCampaigns,
} from "@/lib/api"
import type { AnalyticsTotals, Campaign, CampaignStatus } from "@/lib/types"
import { cn, defaultDateRange, formatCurrency } from "@/lib/utils"
import { TrafficQualityPanel } from "@/components/app/traffic-quality-panel"
import { CampaignStatusBadge } from "@/components/app/campaign-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Row = {
  campaign: Campaign
  totals: AnalyticsTotals | "error" | undefined
}

// The campaign-performance request is backed by ClickHouse, which can take
// far longer than the rest of this page's (Postgres-backed) data if the
// analytics warehouse is slow to respond - without a bound, a single slow
// query left the table stuck on its loading skeleton indefinitely with no
// way to tell the user anything went wrong or let them retry. This doesn't
// cancel the underlying request (fetch has no way to do that here), it just
// stops the UI from waiting on it forever.
const STATS_TIMEOUT_MS = 20_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export function StatisticsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [range, setRange] = React.useState(defaultDateRange)
  const [statusFilter, setStatusFilter] = React.useState<
    CampaignStatus | "ALL"
  >("ALL")
  const [countryFilter, setCountryFilter] = React.useState("ALL")
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(
    async (startDate: string, endDate: string) => {
      setLoading(true)
      try {
        // Neither request depends on the other's result (performance is
        // keyed by date range, not by the campaign list), so fire them
        // together instead of waterfalling one full round trip after the
        // other before the ClickHouse query even starts.
        const [{ campaigns }, perfResult] = await Promise.all([
          withTimeout(
            listCampaigns({ pageSize: 100 }),
            STATS_TIMEOUT_MS,
            "This is taking longer than expected to load - click Apply to try again."
          ),
          // One batched request for every campaign's totals instead of firing
          // a separate performance request per campaign (previously an N+1
          // into ClickHouse - see AdvertiserService.getCampaignsPerformance).
          withTimeout(
            getCampaignsPerformance(startDate, endDate),
            STATS_TIMEOUT_MS,
            "Statistics are taking longer than expected to load - click Apply to try again."
          ).then(
            (byCampaignId) => ({ ok: true as const, byCampaignId }),
            (perfError) => ({ ok: false as const, perfError })
          ),
        ])

        if (perfResult.ok) {
          setRows(
            campaigns.map((campaign) => ({
              campaign,
              totals: perfResult.byCampaignId[campaign.id] ?? {
                impressions: 0,
                clicks: 0,
                ctr: 0,
                spend: 0,
                payout: 0,
              },
            }))
          )
        } else {
          setRows(
            campaigns.map((campaign) => ({ campaign, totals: "error" as const }))
          )
          toast.error(
            perfResult.perfError instanceof ApiError
              ? perfResult.perfError.message
              : perfResult.perfError instanceof Error
                ? perfResult.perfError.message
                : "Could not load campaign statistics"
          )
        }
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Could not load statistics"
        )
      } finally {
        setLoading(false)
      }
    },
    []
  )

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(range.startDate, range.endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableCountries = React.useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => r.campaign.targetCountries.forEach((c) => set.add(c)))
    return Array.from(set).sort()
  }, [rows])

  const filteredRows = rows.filter((row) => {
    if (statusFilter !== "ALL" && row.campaign.status !== statusFilter) {
      return false
    }
    if (
      countryFilter !== "ALL" &&
      !row.campaign.targetCountries.includes(countryFilter)
    ) {
      return false
    }
    return true
  })

  const grandTotals = filteredRows.reduce(
    (acc, row) => {
      if (row.totals && row.totals !== "error") {
        acc.impressions += row.totals.impressions
        acc.clicks += row.totals.clicks
        acc.spend += row.totals.spend
      }
      return acc
    },
    { impressions: 0, clicks: 0, spend: 0 }
  )

  return (
    <div
      className={cn(
        "space-y-6",
        !embedded && "px-4 py-10 sm:px-6 lg:px-8"
      )}
    >
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
          <p className="font-medium text-foreground/75">
            Impressions, clicks, CTR, and spend per campaign for the selected
            date range.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-bold tracking-tight">Statistics</h2>
          <p className="text-sm font-medium text-foreground/75">
            Impressions, clicks, CTR, and spend per campaign for the selected
            date range.
          </p>
        </div>
      )}

      {/* Filter bar */}
      <Card className="rounded-2xl border-none py-0 shadow-sm ring-1 ring-border">
        <CardContent className="flex flex-wrap items-end gap-4 py-5">
          <div className="grid gap-1.5">
            <Label
              htmlFor="stats-from"
              className="text-[11px] font-bold tracking-wide font-medium text-foreground/75 uppercase"
            >
              Date range
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="stats-from"
                type="date"
                className="w-40 rounded-lg"
                value={range.startDate}
                onChange={(e) =>
                  setRange((r) => ({ ...r, startDate: e.target.value }))
                }
              />
              <span className="font-medium text-foreground/75">-</span>
              <Input
                id="stats-to"
                type="date"
                className="w-40 rounded-lg"
                value={range.endDate}
                onChange={(e) =>
                  setRange((r) => ({ ...r, endDate: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="stats-country"
              className="text-[11px] font-bold tracking-wide font-medium text-foreground/75 uppercase"
            >
              Country
            </Label>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger id="stats-country" className="w-40 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All countries</SelectItem>
                {availableCountries.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="stats-status"
              className="text-[11px] font-bold tracking-wide font-medium text-foreground/75 uppercase"
            >
              Campaign status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CampaignStatus | "ALL")}
            >
              <SelectTrigger id="stats-status" className="w-44 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {(
                  [
                    "DRAFT",
                    "PENDING_REVIEW",
                    "ACTIVE",
                    "PAUSED",
                    "COMPLETED",
                    "ARCHIVED",
                  ] as CampaignStatus[]
                ).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => load(range.startDate, range.endDate)}
            disabled={loading}
            className="brand-gradient rounded-lg border-0 font-semibold text-white"
          >
            {loading ? "Applying..." : "Apply"}
          </Button>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          icon={Eye}
          iconClassName="bg-indigo-50 text-indigo-600"
          label="Impressions"
          value={grandTotals.impressions.toLocaleString()}
        />
        <SummaryTile
          icon={MousePointerClick}
          iconClassName="bg-pink-50 text-pink-600"
          label="Clicks"
          value={grandTotals.clicks.toLocaleString()}
        />
        <SummaryTile
          icon={Wallet}
          iconClassName="bg-orange-50 text-orange-600"
          label="Spent, $"
          value={formatCurrency(grandTotals.spend)}
        />
      </div>

      <Card className="rounded-2xl border-none py-0 shadow-sm ring-1 ring-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 [&_th]:text-[11px] [&_th]:font-bold [&_th]:tracking-wide [&_th]:font-medium text-foreground/75 [&_th]:uppercase">
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Spent, $</TableHead>
                <TableHead className="text-right">CPC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && filteredRows.length === 0 ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm font-medium text-foreground/75"
                  >
                    It looks like you have no statistics. Please, check your
                    running campaigns or create a new one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <StatisticsRow key={row.campaign.id} row={row} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="space-y-3 pt-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            Traffic Quality
          </h2>
          <p className="text-sm font-medium text-foreground/75">
            Clicks blocked or flagged as invalid traffic across your
            campaigns - you were never billed for these.
          </p>
        </div>
        <TrafficQualityPanel
          description="Clicks the ad network's fraud detection blocked or flagged before they could bill your budget - e.g. clicks with no matching ad impression, from datacenter/hosting IPs, or from a single IP clicking far too fast."
          fetchTrafficQuality={getAdvertiserTrafficQuality}
        />
      </div>
    </div>
  )
}

function StatisticsRow({ row }: { row: Row }) {
  const { campaign, totals } = row

  if (totals === undefined) {
    return (
      <TableRow>
        <TableCell className="font-semibold">{campaign.campaignName}</TableCell>
        <TableCell>
          <CampaignStatusBadge status={campaign.status} />
        </TableCell>
        <TableCell colSpan={5}>
          <Skeleton className="ml-auto h-4 w-full" />
        </TableCell>
      </TableRow>
    )
  }

  if (totals === "error") {
    return (
      <TableRow>
        <TableCell className="font-semibold">{campaign.campaignName}</TableCell>
        <TableCell>
          <CampaignStatusBadge status={campaign.status} />
        </TableCell>
        <TableCell colSpan={5} className="text-center font-medium text-foreground/75">
          -
        </TableCell>
      </TableRow>
    )
  }

  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : null

  return (
    <TableRow>
      <TableCell className="font-semibold">{campaign.campaignName}</TableCell>
      <TableCell>
        <CampaignStatusBadge status={campaign.status} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {totals.impressions.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {totals.clicks.toLocaleString()}
      </TableCell>
      {/* totals.ctr is already a percentage number from the backend (e.g.
          8.33 meaning 8.33%, not a 0-1 fraction) - formatPercent multiplies
          by 100 again, which used to show impossible values like 833% for
          an 8.33% CTR. */}
      <TableCell className="text-right tabular-nums">
        {totals.ctr.toFixed(2)}%
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(totals.spend)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {cpc !== null ? formatCurrency(cpc) : "-"}
      </TableCell>
    </TableRow>
  )
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  iconClassName,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
}) {
  return (
    <Card className="rounded-2xl border-none py-0 shadow-sm ring-1 ring-border">
      <CardContent className="flex items-start justify-between gap-3 py-5">
        <div>
          <p className="text-sm font-medium text-foreground/75">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            iconClassName
          )}
        >
          <Icon className="size-4.5" />
        </span>
      </CardContent>
    </Card>
  )
}
