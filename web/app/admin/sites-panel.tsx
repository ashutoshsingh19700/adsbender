"use client"

import * as React from "react"
import { toast } from "sonner"

import { adminListSites, adminUpdateSiteStatus, ApiError } from "@/lib/api"
import type { AdminSite, SiteStatus } from "@/lib/types"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

const STATUS_FILTERS: { value: SiteStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
]

export function SitesPanel() {
  const [statusFilter, setStatusFilter] = React.useState<SiteStatus | "ALL">(
    "ALL"
  )
  const [sites, setSites] = React.useState<AdminSite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionState, setActionState] = React.useState<
    Record<string, boolean>
  >({})
  const [deactivateTarget, setDeactivateTarget] = React.useState<AdminSite | null>(
    null
  )

  const load = React.useCallback(async (status: SiteStatus | "ALL") => {
    setLoading(true)
    try {
      const result = await adminListSites({
        pageSize: 100,
        status: status === "ALL" ? undefined : status,
      })
      setSites(result.sites)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load sites"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(statusFilter)
  }, [load, statusFilter])

  function applyUpdate(id: string, patch: Partial<AdminSite>) {
    setSites((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  async function activate(site: AdminSite) {
    setActionState((s) => ({ ...s, [site.id]: true }))
    try {
      const updated = await adminUpdateSiteStatus(site.id, "ACTIVE")
      applyUpdate(site.id, { status: updated.status })
      toast.success(`${updated.domain} activated`)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not activate site"
      )
    } finally {
      setActionState((s) => ({ ...s, [site.id]: false }))
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return
    const site = deactivateTarget
    setActionState((s) => ({ ...s, [site.id]: true }))
    try {
      const updated = await adminUpdateSiteStatus(site.id, "INACTIVE")
      applyUpdate(site.id, { status: updated.status })
      toast.success(`${updated.domain} deactivated`)
      setDeactivateTarget(null)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not deactivate site"
      )
    } finally {
      setActionState((s) => ({ ...s, [site.id]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="site-status-filter">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as SiteStatus | "ALL")}
          >
            <SelectTrigger id="site-status-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && sites.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !loading && sites.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No publisher sites match this filter.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Publisher</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">
                        {site.domain}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{site.publisher.name}</div>
                        <div className="text-muted-foreground">
                          {site.publisher.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={site.verified ? "default" : "outline"}>
                          {site.verified ? "Verified" : "Unverified"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            site.status === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {site.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SiteActions
                          site={site}
                          busy={!!actionState[site.id]}
                          onActivate={() => activate(site)}
                          onDeactivate={() => setDeactivateTarget(site)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="grid gap-3 sm:hidden">
            {sites.map((site) => (
              <Card key={site.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{site.domain}</p>
                      <p className="text-sm text-muted-foreground">
                        {site.publisher.name} · {site.publisher.email}
                      </p>
                    </div>
                    <Badge
                      variant={site.status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {site.status}
                    </Badge>
                  </div>
                  <Badge variant={site.verified ? "default" : "outline"}>
                    {site.verified ? "Verified" : "Unverified"}
                  </Badge>
                  <SiteActions
                    site={site}
                    busy={!!actionState[site.id]}
                    onActivate={() => activate(site)}
                    onDeactivate={() => setDeactivateTarget(site)}
                    wrap
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deactivateTarget?.domain}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This flags the site inactive for moderation. The publisher can
              still see it and it can be reactivated at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDeactivate()
              }}
              disabled={
                deactivateTarget ? actionState[deactivateTarget.id] : false
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SiteActions({
  site,
  busy,
  onActivate,
  onDeactivate,
  wrap = false,
}: {
  site: AdminSite
  busy: boolean
  onActivate: () => void
  onDeactivate: () => void
  wrap?: boolean
}) {
  return (
    <div
      className={wrap ? "flex flex-wrap gap-2" : "flex justify-end gap-1.5"}
    >
      {site.status === "INACTIVE" ? (
        <Button size="sm" variant="outline" onClick={onActivate} disabled={busy}>
          Activate
        </Button>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          onClick={onDeactivate}
          disabled={busy}
        >
          Deactivate
        </Button>
      )}
    </div>
  )
}
