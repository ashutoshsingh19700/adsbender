"use client"

import * as React from "react"
import { toast } from "sonner"
import { Globe2, Search, Wallet } from "lucide-react"

import {
  adminGetPublisher,
  adminGetPublisherCountryBreakdown,
  adminListPublishers,
  ApiError,
} from "@/lib/api"
import type {
  AdminPublisherCountryRow,
  AdminPublisherDetail,
  AdminPublisherSummary,
} from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { countryFlag, COUNTRIES } from "@/app/advertiser/campaign-fields"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/app/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const COUNTRY_NAME: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.value, c.label])
)

function countryLabel(code: string) {
  if (!code || code === "Unknown") return "Unknown"
  return `${countryFlag(code)} ${COUNTRY_NAME[code] ?? code}`
}

const PAYOUT_BADGE: Record<string, "outline" | "secondary" | "destructive"> = {
  REQUESTED: "outline",
  PROCESSING: "outline",
  COMPLETED: "secondary",
  FAILED: "destructive",
}

export function PublishersPanel() {
  const [search, setSearch] = React.useState("")
  const [publishers, setPublishers] = React.useState<AdminPublisherSummary[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const load = React.useCallback(async (q: string) => {
    setLoading(true)
    try {
      const result = await adminListPublishers({
        pageSize: 100,
        search: q.trim() || undefined,
      })
      setPublishers(result.publishers)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load publishers"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const handle = setTimeout(() => {
      load(search)
    }, 250)
    return () => clearTimeout(handle)
  }, [load, search])

  return (
    <div className="space-y-4">
      <PublisherCountryReport />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 font-medium text-foreground/75" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      {loading && publishers.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !loading && publishers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm font-medium text-foreground/75">
            No publishers match this search.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Sites</TableHead>
                  <TableHead className="text-right">Total Earned</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publishers.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm font-medium text-foreground/75">
                        {p.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.country ? countryLabel(p.country) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.siteCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(p.totalEarned)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(p.pendingEarnings)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-medium text-foreground/75">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <PublisherDetailSheet
        publisherId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

function PublisherCountryReport() {
  const [rows, setRows] = React.useState<AdminPublisherCountryRow[] | null>(
    null
  )
  const [totalUsers, setTotalUsers] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminGetPublisherCountryBreakdown()
      .then((result) => {
        if (cancelled) return
        setRows(result.rows)
        setTotalUsers(result.totalUsers)
      })
      .catch((error) => {
        if (cancelled) return
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not load country report"
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleRows = expanded ? rows : rows?.slice(0, 8)

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center gap-2">
          <Globe2 className="size-4 font-medium text-foreground/75" />
          <h3 className="text-sm font-semibold">Publishers by country</h3>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : !rows || rows.length === 0 ? (
          <p className="text-sm font-medium text-foreground/75">
            No publisher accounts yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Publishers</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                    <TableHead className="text-right">Sites</TableHead>
                    <TableHead className="text-right">Total Earned</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows?.map((row) => (
                    <TableRow key={row.country}>
                      <TableCell>{countryLabel(row.country)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.userCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalUsers > 0
                          ? `${((row.userCount / totalUsers) * 100).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.siteCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.totalEarned)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.pendingEarnings)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-sm font-medium text-foreground/75">
              <span>
                {rows.length} {rows.length === 1 ? "country" : "countries"} ·{" "}
                {totalUsers} publishers total
              </span>
              {rows.length > 8 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {expanded ? "Show less" : `Show all ${rows.length}`}
                </button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PublisherDetailSheet({
  publisherId,
  onClose,
}: {
  publisherId: string | null
  onClose: () => void
}) {
  const [detail, setDetail] = React.useState<AdminPublisherDetail | null>(null)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async (id: string) => {
    setLoading(true)
    try {
      const result = await adminGetPublisher(id)
      setDetail(result)
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not load publisher details"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // See the matching comment in advertisers-panel.tsx - deliberately not
    // cleared here so the Sheet's close animation doesn't blank out first.
    if (!publisherId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(publisherId)
  }, [publisherId, load])

  const sortedCountries = React.useMemo(
    () =>
      [...(detail?.audienceByCountry ?? [])].sort(
        (a, b) => b.impressions - a.impressions
      ),
    [detail]
  )

  return (
    <Sheet open={!!publisherId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-xl gap-6 overflow-y-auto sm:max-w-xl"
      >
        {loading || !detail ? (
          <div className="space-y-4 p-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-lg">
                {detail.publisher.name}
              </SheetTitle>
              <SheetDescription>
                {detail.publisher.email}
                {detail.publisher.country
                  ? ` · ${countryLabel(detail.publisher.country)}`
                  : ""}
                {" · Joined "}
                {new Date(detail.publisher.createdAt).toLocaleDateString()}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3">
              <StatCard
                label="Total Earned"
                value={formatCurrency(detail.publisher.totalEarned)}
                icon={Wallet}
              />
              <StatCard
                label="Pending Earnings"
                value={formatCurrency(detail.publisher.pendingEarnings)}
              />
              <StatCard
                label="Total Withdrawn"
                value={formatCurrency(detail.publisher.totalWithdrawn)}
              />
              <StatCard
                label="Impressions (30d)"
                value={detail.totals.impressions.toLocaleString()}
              />
              <StatCard
                label="Clicks (30d)"
                value={detail.totals.clicks.toLocaleString()}
              />
              <StatCard
                label="Payout (30d)"
                value={formatCurrency(detail.totals.payout)}
              />
            </div>

            <div className="space-y-2 px-2">
              <h3 className="text-sm font-semibold">Sites</h3>
              {detail.sites.length === 0 ? (
                <p className="text-sm font-medium text-foreground/75">
                  No sites registered yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.sites.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="max-w-40 truncate font-medium">
                            {s.domain}
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.country ? countryLabel(s.country) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.verified ? "default" : "outline"}>
                              {s.verified ? "Verified" : "Unverified"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                s.status === "ACTIVE" ? "default" : "secondary"
                              }
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2 px-2">
              <h3 className="text-sm font-semibold">Recent payouts</h3>
              {detail.payouts.length === 0 ? (
                <p className="text-sm font-medium text-foreground/75">
                  No payouts requested yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.payouts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(p.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={PAYOUT_BADGE[p.status]}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium text-foreground/75">
                            {new Date(p.requestedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2 px-2 pb-4">
              <div className="flex items-center gap-2">
                <Globe2 className="size-4 font-medium text-foreground/75" />
                <h3 className="text-sm font-semibold">
                  Audience by country (last 30 days)
                </h3>
              </div>
              <p className="text-xs font-medium text-foreground/75">
                Derived from the visitor&apos;s IP address at ad-serve time
                (geo-IP lookup) - the same signal that flags datacenter/proxy
                traffic on the Traffic Quality tab.
              </p>
              {sortedCountries.length === 0 ? (
                <p className="text-sm font-medium text-foreground/75">
                  No traffic in this window yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">
                          Impressions
                        </TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCountries.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>{countryLabel(row.key)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.impressions.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.clicks.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(row.payout)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
