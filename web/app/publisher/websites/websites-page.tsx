"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Download,
  Eye,
  EyeOff,
  Search,
  X,
} from "lucide-react"

import { ApiError, listAdZones, listPublisherSites } from "@/lib/api"
import type { AdZone, AdZoneStatus, PublisherSite } from "@/lib/types"
import { AddWebsiteDialog } from "@/app/publisher/websites/add-website-dialog"
import { ZoneSnippetDialog } from "@/app/publisher/ad-zone-manager"
import { AD_UNIT_FORMAT_OPTIONS } from "@/app/publisher/websites/site-meta"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

type StatusFilter = "all" | "verified" | "pending"

// Whether the "3 steps to monetize" banner is dismissed - remembered per
// browser the same way the extra add-website fields are (see site-meta.ts).
const TIPS_DISMISSED_KEY = "adnetwork.publisher.websiteTipsDismissed"

const ZONE_STATUS_STYLES: Record<AdZoneStatus, string> = {
  ACTIVE: "border-emerald-300 text-emerald-700",
  PAUSED: "border-amber-300 text-amber-700",
  ARCHIVED: "border-muted-foreground/30 text-muted-foreground",
}

// AD_UNIT_FORMAT_OPTIONS covers the values this dialog itself creates
// (popunder, native-banner, ...) - zones made from the generic Publisher
// Portal "Create ad zone" flow instead use IAB-size codes like
// "MEDIUM_RECTANGLE_300X250", which just get prettified as a fallback.
function formatZoneLayoutLabel(layoutType: string) {
  const known = AD_UNIT_FORMAT_OPTIONS.find(
    (option) => option.value === layoutType
  )
  if (known) return known.label
  return layoutType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function WebsitesPage() {
  const [sites, setSites] = React.useState<PublisherSite[]>([])
  const [zones, setZones] = React.useState<AdZone[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [tipsHidden, setTipsHidden] = React.useState(false)
  const [expandedSiteIds, setExpandedSiteIds] = React.useState<Set<string>>(
    new Set()
  )
  const [snippetZone, setSnippetZone] = React.useState<AdZone | null>(null)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTipsHidden(window.localStorage.getItem(TIPS_DISMISSED_KEY) === "1")
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [sitesResult, zonesResult] = await Promise.all([
        listPublisherSites({ pageSize: 100 }),
        listAdZones({ pageSize: 200 }),
      ])
      setSites(sitesResult.sites)
      setZones(zonesResult.zones)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load websites"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  function toggleExpanded(siteId: string) {
    setExpandedSiteIds((prev) => {
      const next = new Set(prev)
      if (next.has(siteId)) {
        next.delete(siteId)
      } else {
        next.add(siteId)
      }
      return next
    })
  }

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function hideTips() {
    setTipsHidden(true)
    window.localStorage.setItem(TIPS_DISMISSED_KEY, "1")
  }

  function showTips() {
    setTipsHidden(false)
    window.localStorage.removeItem(TIPS_DISMISSED_KEY)
  }

  function resetFilters() {
    setSearch("")
    setStatusFilter("all")
  }

  function exportWebsites() {
    if (visibleSites.length === 0) return
    const header = ["Domain", "Category", "Adult ads", "Status"]
    const lines = visibleSites.map((site) =>
      [
        site.domain,
        site.category ?? "",
        site.adultAds ? "Yes" : "No",
        site.verified ? "Verified" : "Pending",
      ].join(",")
    )
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "websites.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const visibleSites = sites.filter((site) => {
    if (
      search.trim() &&
      !site.domain.toLowerCase().includes(search.trim().toLowerCase())
    ) {
      return false
    }
    if (statusFilter === "verified" && !site.verified) return false
    if (statusFilter === "pending" && site.verified) return false
    return true
  })

  const filtersActive = search.trim() !== "" || statusFilter !== "all"

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Websites</h1>
          <p className="text-muted-foreground">
            Add the sites you want to monetize and manage their ad units.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Add website</Button>
      </div>

      {!tipsHidden ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="text-sm font-semibold">
              3 steps to monetize your website
            </p>
            <button
              type="button"
              onClick={hideTips}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <EyeOff className="size-3.5" /> Hide tips
            </button>
          </div>
          <Image
            src="/images/monetize-steps.png"
            alt="Three steps to monetize your website: add your website, create an ad unit, then copy and embed the code."
            width={1719}
            height={915}
            className="w-full"
            priority
          />
        </Card>
      ) : (
        // Dismissing the banner above used to be permanent — the only way
        // back was clearing localStorage by hand. This keeps a slim,
        // always-visible affordance to bring it back, same as Adsterra's
        // "SHOW TIPS" link on collapsed sections.
        <Card className="flex items-center justify-between px-5 py-3">
          <p className="text-sm font-medium text-muted-foreground">
            3 steps to monetize your website
          </p>
          <button
            type="button"
            onClick={showTips}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Eye className="size-3.5" /> Show tips
          </button>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by domain"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Website status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive ? (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="size-3.5" /> Reset filters
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={exportWebsites}
          disabled={visibleSites.length === 0}
        >
          <Download className="size-3.5" /> Export websites
        </Button>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
            <p className="font-medium">No websites yet</p>
            <p className="text-sm text-muted-foreground">
              Click &quot;Add website&quot; above to get started.
            </p>
          </div>
        ) : visibleSites.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
            <p className="font-medium">No websites match your filters</p>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Website</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSites.map((site) => {
                const siteZones = zones.filter((zone) => zone.siteId === site.id)
                const expanded = expandedSiteIds.has(site.id)
                return (
                  <React.Fragment key={site.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(site.id)}
                          disabled={siteZones.length === 0}
                          className="flex items-center gap-1.5 disabled:cursor-default"
                        >
                          {siteZones.length > 0 ? (
                            expanded ? (
                              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                            )
                          ) : (
                            <span className="inline-block size-3.5 shrink-0" />
                          )}
                          {site.domain}
                          {siteZones.length > 0 ? (
                            <span className="text-xs font-normal text-muted-foreground">
                              {siteZones.length} ad unit
                              {siteZones.length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          {site.category ?? "—"}
                          {site.adultAds ? (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                            >
                              Adult
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            site.verified
                              ? "border-emerald-300 text-emerald-700"
                              : "border-amber-300 text-amber-700"
                          }
                        >
                          {site.verified ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <Clock className="size-3" />
                          )}
                          {site.verified ? "Verified" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" size="sm" asChild>
                          <Link href="/publisher/statistics">Statistics</Link>
                        </Button>
                        <Button variant="link" size="sm" asChild>
                          <Link href="/publisher">Ad unit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded
                      ? siteZones.map((zone) => (
                          <TableRow
                            key={zone.id}
                            className="bg-muted/30 hover:bg-muted/30"
                          >
                            <TableCell className="py-2 pl-9 text-sm">
                              {zone.zoneName}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatZoneLayoutLabel(zone.layoutType)}
                              </span>
                            </TableCell>
                            <TableCell />
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={ZONE_STATUS_STYLES[zone.status]}
                              >
                                {zone.status === "ACTIVE"
                                  ? "Active"
                                  : zone.status === "PAUSED"
                                    ? "Paused"
                                    : "Archived"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button variant="link" size="sm" asChild>
                                <Link href="/publisher/statistics">
                                  Statistics
                                </Link>
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => setSnippetZone(zone)}
                              >
                                <Code2 className="size-3.5" /> Get code
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      : null}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ZoneSnippetDialog
        zone={snippetZone}
        onOpenChange={(open) => {
          if (!open) setSnippetZone(null)
        }}
      />

      <AddWebsiteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => load()}
      />
    </div>
  )
}
