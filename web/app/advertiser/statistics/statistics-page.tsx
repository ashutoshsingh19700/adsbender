"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  ApiError,
  getCampaignPerformance,
  listCampaigns,
} from "@/lib/api"
import type { AnalyticsTotals, Campaign, CampaignStatus } from "@/lib/types"
import { defaultDateRange, formatCurrency, formatPercent } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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

const STATUS_BADGE: Record<
  CampaignStatus,
  "default" | "outline" | "secondary"
> = {
  DRAFT: "outline",
  PENDING_REVIEW: "outline",
  ACTIVE: "default",
  PAUSED: "outline",
  COMPLETED: "secondary",
  ARCHIVED: "secondary",
}

type Row = {
  campaign: Campaign
  totals: AnalyticsTotals | "error" | undefined
}

export function StatisticsPage() {
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
        const { campaigns } = await listCampaigns({ pageSize: 100 })
        setRows(campaigns.map((campaign) => ({ campaign, totals: undefined })))

        campaigns.forEach((campaign) => {
          getCampaignPerformance(campaign.id, startDate, endDate)
            .then((result) => {
              setRows((current) =>
                current.map((row) =>
                  row.campaign.id === campaign.id
                    ? { ...row, totals: result.totals }
                    : row
                )
              )
            })
            .catch(() => {
              setRows((current) =>
                current.map((row) =>
                  row.campaign.id === campaign.id
                    ? { ...row, totals: "error" }
                    : row
                )
              )
            })
        })
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
    <div className="space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statistics</h1>
        <p className="text-muted-foreground">
          Impressions, clicks, CTR, and spend per campaign for the selected
          date range.
        </p>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="stats-from">Date range</Label>
            <div className="flex items-center gap-2">
              <Input
                id="stats-from"
                type="date"
                className="w-40"
                value={range.startDate}
                onChange={(e) =>
                  setRange((r) => ({ ...r, startDate: e.target.value }))
                }
              />
              <span className="text-muted-foreground">-</span>
              <Input
                id="stats-to"
                type="date"
                className="w-40"
                value={range.endDate}
                onChange={(e) =>
                  setRange((r) => ({ ...r, endDate: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stats-country">Country</Label>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger id="stats-country" className="w-40">
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
            <Label htmlFor="stats-status">Campaign status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CampaignStatus | "ALL")}
            >
              <SelectTrigger id="stats-status" className="w-44">
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
          >
            {loading ? "Applying..." : "Apply"}
          </Button>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Impressions"
          value={grandTotals.impressions.toLocaleString()}
        />
        <SummaryTile label="Clicks" value={grandTotals.clicks.toLocaleString()} />
        <SummaryTile label="Spent, $" value={formatCurrency(grandTotals.spend)} />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
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
                    className="py-10 text-center text-sm text-muted-foreground"
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
    </div>
  )
}

function StatisticsRow({ row }: { row: Row }) {
  const { campaign, totals } = row

  if (totals === undefined) {
    return (
      <TableRow>
        <TableCell className="font-medium">{campaign.campaignName}</TableCell>
        <TableCell>
          <Badge variant={STATUS_BADGE[campaign.status]}>{campaign.status}</Badge>
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
        <TableCell className="font-medium">{campaign.campaignName}</TableCell>
        <TableCell>
          <Badge variant={STATUS_BADGE[campaign.status]}>{campaign.status}</Badge>
        </TableCell>
        <TableCell colSpan={5} className="text-center text-muted-foreground">
          -
        </TableCell>
      </TableRow>
    )
  }

  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : null

  return (
    <TableRow>
      <TableCell className="font-medium">{campaign.campaignName}</TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE[campaign.status]}>{campaign.status}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {totals.impressions.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {totals.clicks.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPercent(totals.ctr)}
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
