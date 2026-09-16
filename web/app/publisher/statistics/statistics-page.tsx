"use client"

import * as React from "react"
import { toast } from "sonner"
import { Download, Info } from "lucide-react"

import { COUNTRIES } from "@/app/advertiser/campaign-fields"
import {
  ApiError,
  getPublisherStatistics,
  getPublisherTrafficQuality,
  listAdZones,
  listPublisherSites,
} from "@/lib/api"
import { TrafficQualityPanel } from "@/components/app/traffic-quality-panel"
import type {
  AdZone,
  PublisherSite,
  StatisticsGroupBy,
  StatisticsResponse,
  StatisticsRow,
} from "@/lib/types"
import { defaultDateRange, formatCurrency } from "@/lib/utils"
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

// Every tab that's backed by a real, queryable dimension - see
// PublisherService.getStatistics / ClickHouseAnalyticsEventStore. "Operating
// System" and "Browser" are NOT here: the backend stores the raw user_agent
// per event but never parses either one out of it, so there is nothing to
// group by yet - they're listed separately below as disabled tabs instead
// of quietly disappearing, so it's clear the gap is data, not UI.
const GROUP_BY_TABS: { value: StatisticsGroupBy; label: string; columnLabel: string }[] = [
  { value: "date", label: "Date", columnLabel: "Date" },
  { value: "domain", label: "Domain", columnLabel: "Domain" },
  { value: "placement", label: "Placement", columnLabel: "Placement" },
  { value: "country", label: "Country", columnLabel: "Country" },
  { value: "device", label: "Device Format", columnLabel: "Device Format" },
]

const UNAVAILABLE_TABS = [
  { label: "Operating System" },
  { label: "Browser" },
]

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
}

function formatGroupLabel(groupBy: StatisticsGroupBy, row: StatisticsRow) {
  if (groupBy === "date") {
    return new Date(row.key + "T00:00:00Z").toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }
  if (groupBy === "device") {
    return DEVICE_LABELS[row.label] ?? row.label
  }
  return row.label
}

function toCsv(groupBy: StatisticsGroupBy, rows: StatisticsRow[]) {
  const columnLabel =
    GROUP_BY_TABS.find((tab) => tab.value === groupBy)?.columnLabel ?? "Group"
  const header = [columnLabel, "Impressions", "Clicks", "CTR", "CPM", "Revenue"]
  const lines = rows.map((row) => {
    const cpm = row.impressions > 0 ? (row.payout / row.impressions) * 1000 : 0
    return [
      formatGroupLabel(groupBy, row),
      row.impressions,
      row.clicks,
      `${row.ctr.toFixed(3)}%`,
      cpm.toFixed(3),
      row.payout.toFixed(2),
    ].join(",")
  })
  return [header.join(","), ...lines].join("\n")
}

export function PublisherStatisticsPage() {
  const [range, setRange] = React.useState(defaultDateRange)
  const [countryFilter, setCountryFilter] = React.useState("ALL")
  const [domainFilter, setDomainFilter] = React.useState("ALL")
  const [placementFilter, setPlacementFilter] = React.useState("ALL")
  const [groupBy, setGroupBy] = React.useState<StatisticsGroupBy>("date")

  const [sites, setSites] = React.useState<PublisherSite[]>([])
  const [zones, setZones] = React.useState<AdZone[]>([])

  const [result, setResult] = React.useState<StatisticsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)

  // Filter option lists load once - they're the publisher's own sites/zones,
  // not affected by the date-range/group-by controls below.
  React.useEffect(() => {
    listPublisherSites({ pageSize: 100 })
      .then((res) => setSites(res.sites))
      .catch(() => {
        // Non-critical: the Domain filter just shows no options.
      })
    listAdZones({ pageSize: 100 })
      .then((res) => setZones(res.zones))
      .catch(() => {
        // Non-critical: the Placement filter just shows no options.
      })
  }, [])

  const load = React.useCallback(
    async (params: {
      startDate: string
      endDate: string
      country: string
      domain: string
      placement: string
      groupBy: StatisticsGroupBy
    }) => {
      setLoading(true)
      try {
        const res = await getPublisherStatistics({
          startDate: params.startDate,
          endDate: params.endDate,
          country: params.country === "ALL" ? undefined : params.country,
          domain: params.domain === "ALL" ? undefined : params.domain,
          zoneId: params.placement === "ALL" ? undefined : params.placement,
          groupBy: params.groupBy,
        })
        setResult(res)
        setPage(1)
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
    load({
      startDate: range.startDate,
      endDate: range.endDate,
      country: countryFilter,
      domain: domainFilter,
      placement: placementFilter,
      groupBy,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyFilters() {
    load({
      startDate: range.startDate,
      endDate: range.endDate,
      country: countryFilter,
      domain: domainFilter,
      placement: placementFilter,
      groupBy,
    })
  }

  function resetFilters() {
    const defaults = defaultDateRange()
    setRange(defaults)
    setCountryFilter("ALL")
    setDomainFilter("ALL")
    setPlacementFilter("ALL")
    load({
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      country: "ALL",
      domain: "ALL",
      placement: "ALL",
      groupBy,
    })
  }

  function changeGroupBy(next: StatisticsGroupBy) {
    setGroupBy(next)
    load({
      startDate: range.startDate,
      endDate: range.endDate,
      country: countryFilter,
      domain: domainFilter,
      placement: placementFilter,
      groupBy: next,
    })
  }

  function exportCsv() {
    if (!result || result.rows.length === 0) return
    const csv = toCsv(groupBy, result.rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `statistics_${range.startDate}_${range.endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const rows = result?.rows ?? []
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, rows.length)

  const columnLabel =
    GROUP_BY_TABS.find((tab) => tab.value === groupBy)?.columnLabel ?? "Date"

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Statistics</h1>
        <p className="font-medium text-foreground/75">
          Impressions, clicks, CTR, CPM, and revenue across your sites and ad
          zones.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="stats-from">Date range &amp; time zone</Label>
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
                <span className="font-medium text-foreground/75">-</span>
                <Input
                  id="stats-to"
                  type="date"
                  className="w-40"
                  value={range.endDate}
                  onChange={(e) =>
                    setRange((r) => ({ ...r, endDate: e.target.value }))
                  }
                />
                <span className="text-xs whitespace-nowrap font-medium text-foreground/75">
                  (UTC)
                </span>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="stats-country">Country</Label>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger id="stats-country" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All countries</SelectItem>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="stats-domain">Domain</Label>
              <Select
                value={domainFilter}
                onValueChange={(v) => {
                  setDomainFilter(v)
                  setPlacementFilter("ALL")
                }}
              >
                <SelectTrigger id="stats-domain" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Domains</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.domain}>
                      {site.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="stats-placement">Placement</Label>
              <Select
                value={placementFilter}
                onValueChange={setPlacementFilter}
                disabled={domainFilter === "ALL"}
              >
                <SelectTrigger id="stats-placement" className="w-48">
                  <SelectValue placeholder="All Placements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Placements</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.zoneName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={applyFilters} disabled={loading}>
              {loading ? "Applying..." : "Apply"}
            </Button>
            <Button variant="outline" onClick={resetFilters} disabled={loading}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Group by */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground/75">Group by</p>
        <div className="flex flex-wrap gap-1.5">
          {GROUP_BY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeGroupBy(tab.value)}
              className={
                "rounded-md border px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors " +
                (groupBy === tab.value
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                  : "border-transparent bg-muted font-medium text-foreground/75 hover:text-foreground")
              }
            >
              {tab.label}
            </button>
          ))}
          {UNAVAILABLE_TABS.map((tab) => (
            <span
              key={tab.label}
              title="Not available yet - the backend doesn't parse browser/OS out of the request user agent."
              className="flex cursor-not-allowed items-center gap-1 rounded-md border border-transparent bg-muted px-3 py-1.5 text-xs font-semibold tracking-wide font-medium text-foreground/75/50 uppercase"
            >
              {tab.label}
              <Info className="size-3" />
            </span>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline disabled:pointer-events-none disabled:opacity-40 dark:text-emerald-400"
          >
            <Download className="size-4" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{columnLabel}</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">CPM</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !result ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm font-medium text-foreground/75"
                  >
                    No statistics for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <StatisticsTableRow
                    key={row.key}
                    row={row}
                    groupBy={groupBy}
                  />
                ))
              )}

              {rows.length > 0 ? (
                <TableRow className="font-semibold">
                  <TableCell>Total:</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(result?.totals.impressions ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(result?.totals.clicks ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(result?.totals.ctr ?? 0).toFixed(3)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(
                      (result?.totals.impressions ?? 0) > 0
                        ? ((result?.totals.payout ?? 0) /
                            (result?.totals.impressions ?? 1)) *
                            1000
                        : 0
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(result?.totals.payout ?? 0)}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4 border-t px-4 py-3 text-sm font-medium text-foreground/75">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROWS_PER_PAGE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tabular-nums">
            {rangeStart}-{rangeEnd} of {rows.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3 pt-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Traffic Quality
          </h2>
          <p className="text-sm font-medium text-foreground/75">
            Bot and click-fraud protection across your ad zones.
          </p>
        </div>
        <TrafficQualityPanel
          description="Impressions and clicks blocked or flagged as invalid traffic across every ad zone you own - this traffic is never billed to advertisers, so it never earns you anything either."
          fetchTrafficQuality={getPublisherTrafficQuality}
        />
      </div>
    </div>
  )
}

function StatisticsTableRow({
  row,
  groupBy,
}: {
  row: StatisticsRow
  groupBy: StatisticsGroupBy
}) {
  const cpm = row.impressions > 0 ? (row.payout / row.impressions) * 1000 : 0

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        {formatGroupLabel(groupBy, row)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.impressions.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.clicks.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.ctr.toFixed(3)}%
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(cpm)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(row.payout)}
      </TableCell>
    </TableRow>
  )
}
