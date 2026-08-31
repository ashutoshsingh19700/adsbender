"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { CheckCircle2, Clock, EyeOff, Search, X } from "lucide-react"

import { ApiError, listPublisherSites } from "@/lib/api"
import type { PublisherSite } from "@/lib/types"
import { AddWebsiteDialog } from "@/app/publisher/websites/add-website-dialog"

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

export function WebsitesPage() {
  const [sites, setSites] = React.useState<PublisherSite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [tipsHidden, setTipsHidden] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTipsHidden(window.localStorage.getItem(TIPS_DISMISSED_KEY) === "1")
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await listPublisherSites({ pageSize: 100 })
      setSites(result.sites)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load websites"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function hideTips() {
    setTipsHidden(true)
    window.localStorage.setItem(TIPS_DISMISSED_KEY, "1")
  }

  function resetFilters() {
    setSearch("")
    setStatusFilter("all")
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
      ) : null}

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
                return (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium">
                      {site.domain}
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
                        <Link href="/analytics">Statistics</Link>
                      </Button>
                      <Button variant="link" size="sm" asChild>
                        <Link href="/publisher">Ad unit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <AddWebsiteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => load()}
      />
    </div>
  )
}
