"use client"

import * as React from "react"
import { toast } from "sonner"
import { Globe2, Megaphone, Search, Wallet } from "lucide-react"

import { adminGetAdvertiser, adminListAdvertisers, ApiError } from "@/lib/api"
import type { AdminAdvertiserDetail, AdminAdvertiserSummary } from "@/lib/types"
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

export function AdvertisersPanel() {
  const [search, setSearch] = React.useState("")
  const [advertisers, setAdvertisers] = React.useState<AdminAdvertiserSummary[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const load = React.useCallback(async (q: string) => {
    setLoading(true)
    try {
      const result = await adminListAdvertisers({
        pageSize: 100,
        search: q.trim() || undefined,
      })
      setAdvertisers(result.advertisers)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load advertisers"
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
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      {loading && advertisers.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !loading && advertisers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No advertisers match this search.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advertiser</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                  <TableHead className="text-right">Total Spend</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advertisers.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(a.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {a.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.country ? countryLabel(a.country) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.campaignCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(a.totalSpend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(a.balance_usd)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <AdvertiserDetailSheet
        advertiserId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

function AdvertiserDetailSheet({
  advertiserId,
  onClose,
}: {
  advertiserId: string | null
  onClose: () => void
}) {
  const [detail, setDetail] = React.useState<AdminAdvertiserDetail | null>(null)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async (id: string) => {
    setLoading(true)
    try {
      const result = await adminGetAdvertiser(id)
      setDetail(result)
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not load advertiser details"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // Deliberately doesn't clear `detail` back to null here - the Sheet
    // plays a close animation with `open=false` before unmounting, and
    // clearing synchronously would blank the panel out from under that
    // animation. The stale data is invisible either way and gets replaced
    // the moment a different row is opened.
    if (!advertiserId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(advertiserId)
  }, [advertiserId, load])

  const sortedCountries = React.useMemo(
    () =>
      [...(detail?.audienceByCountry ?? [])].sort(
        (a, b) => b.impressions - a.impressions
      ),
    [detail]
  )

  return (
    <Sheet open={!!advertiserId} onOpenChange={(open) => !open && onClose()}>
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
                {detail.advertiser.name}
              </SheetTitle>
              <SheetDescription>
                {detail.advertiser.email}
                {detail.advertiser.country
                  ? ` · ${countryLabel(detail.advertiser.country)}`
                  : ""}
                {" · Joined "}
                {new Date(detail.advertiser.createdAt).toLocaleDateString()}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3">
              <StatCard
                label="Total Spend"
                value={formatCurrency(detail.totalSpend)}
                icon={Wallet}
              />
              <StatCard
                label="Campaigns"
                value={String(detail.campaigns.length)}
                icon={Megaphone}
              />
              <StatCard
                label="Wallet Balance"
                value={formatCurrency(detail.advertiser.balance_usd)}
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
                label="Spend (30d)"
                value={formatCurrency(detail.totals.spend)}
              />
            </div>

            <div className="space-y-2 px-2">
              <h3 className="text-sm font-semibold">Campaigns</h3>
              {detail.campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No campaigns yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.campaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="max-w-40 truncate font-medium">
                            {c.campaignName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(c.spentAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(c.totalBudget)}
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
                <Globe2 className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  Audience by country (last 30 days)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Derived from the visitor&apos;s IP address at ad-serve time
                (geo-IP lookup), same source used to enforce this
                advertiser&apos;s campaign country targeting.
              </p>
              {sortedCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No delivery data in this window yet.
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
                        <TableHead className="text-right">Spend</TableHead>
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
                            {formatCurrency(row.spend)}
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
