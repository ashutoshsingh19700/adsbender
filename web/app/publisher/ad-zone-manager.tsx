"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Archive,
  BarChart3,
  Check,
  Copy,
  Loader2,
  Pause,
  Pencil,
  Play,
} from "lucide-react"

import {
  ApiError,
  archiveAdZone,
  getAdZonePerformance,
  getAdZoneSnippet,
  listAdZones,
  updateAdZone,
  updateAdZoneStatus,
} from "@/lib/api"
import type { AdZone, AdZoneStatus, AnalyticsResponse } from "@/lib/types"
import { defaultDateRange, formatPercent } from "@/lib/utils"
import {
  LAYOUT_TYPES,
  zoneSchema,
  type ZoneFormOutput,
} from "@/app/publisher/zone-form"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
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
import { Textarea } from "@/components/ui/textarea"

const STATUS_BADGE: Record<AdZoneStatus, "default" | "outline" | "secondary"> = {
  ACTIVE: "default",
  PAUSED: "outline",
  ARCHIVED: "secondary",
}

type ActionKind = "status" | "archive"

export function AdZoneManager({ refreshToken = 0 }: { refreshToken?: number }) {
  const [zones, setZones] = React.useState<AdZone[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionState, setActionState] = React.useState<
    Record<string, ActionKind | undefined>
  >({})

  const [editZone, setEditZone] = React.useState<AdZone | null>(null)
  const [snippetZone, setSnippetZone] = React.useState<AdZone | null>(null)
  const [performanceZone, setPerformanceZone] = React.useState<AdZone | null>(
    null
  )
  const [archiveZone, setArchiveZone] = React.useState<AdZone | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await listAdZones({ pageSize: 100 })
      setZones(result.zones)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load ad zones"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load, refreshToken])

  async function toggleStatus(zone: AdZone) {
    const next: AdZoneStatus = zone.status === "ACTIVE" ? "PAUSED" : "ACTIVE"
    setActionState((s) => ({ ...s, [zone.id]: "status" }))
    try {
      const updated = await updateAdZoneStatus(zone.id, next)
      setZones((zs) => zs.map((z) => (z.id === updated.id ? updated : z)))
      toast.success(
        `"${updated.zoneName}" is now ${updated.status.toLowerCase()}`
      )
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not update zone status"
      )
    } finally {
      setActionState((s) => ({ ...s, [zone.id]: undefined }))
    }
  }

  async function confirmArchive() {
    if (!archiveZone) return
    const zone = archiveZone
    setActionState((s) => ({ ...s, [zone.id]: "archive" }))
    try {
      const updated = await archiveAdZone(zone.id)
      setZones((zs) => zs.map((z) => (z.id === updated.id ? updated : z)))
      toast.success(`"${updated.zoneName}" archived`)
      setArchiveZone(null)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not archive zone"
      )
    } finally {
      setActionState((s) => ({ ...s, [zone.id]: undefined }))
    }
  }

  function handleZoneUpdated(updated: AdZone) {
    setZones((zs) => zs.map((z) => (z.id === updated.id ? updated : z)))
  }

  if (loading && zones.length === 0) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (!loading && zones.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You haven&apos;t created any ad zones yet. Create one above to get
          an embeddable snippet.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Desktop / tablet: table */}
      <Card className="hidden sm:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Layout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.zoneName}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {zone.width}×{zone.height}
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {zone.layoutType}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[zone.status]}>
                      {zone.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(zone.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <ZoneActions
                      zone={zone}
                      actionState={actionState[zone.id]}
                      onEdit={() => setEditZone(zone)}
                      onToggleStatus={() => toggleStatus(zone)}
                      onArchive={() => setArchiveZone(zone)}
                      onSnippet={() => setSnippetZone(zone)}
                      onPerformance={() => setPerformanceZone(zone)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile: stacked cards */}
      <div className="grid gap-3 sm:hidden">
        {zones.map((zone) => (
          <Card key={zone.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{zone.zoneName}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {zone.layoutType} · {zone.width}×{zone.height}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[zone.status]}>{zone.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Created {new Date(zone.createdAt).toLocaleDateString()}
              </p>
              <ZoneActions
                zone={zone}
                actionState={actionState[zone.id]}
                onEdit={() => setEditZone(zone)}
                onToggleStatus={() => toggleStatus(zone)}
                onArchive={() => setArchiveZone(zone)}
                onSnippet={() => setSnippetZone(zone)}
                onPerformance={() => setPerformanceZone(zone)}
                wrap
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <ZoneEditDialog
        zone={editZone}
        onOpenChange={(open) => !open && setEditZone(null)}
        onSaved={handleZoneUpdated}
      />
      <ZoneSnippetDialog
        zone={snippetZone}
        onOpenChange={(open) => !open && setSnippetZone(null)}
      />
      <ZonePerformanceDialog
        zone={performanceZone}
        onOpenChange={(open) => !open && setPerformanceZone(null)}
      />

      <AlertDialog
        open={!!archiveZone}
        onOpenChange={(open) => !open && setArchiveZone(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive &quot;{archiveZone?.zoneName}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archiving stops this zone from serving ads and can&apos;t be
              undone from here - an archived zone can&apos;t be reactivated.
              Its snippet and history remain, but the zone becomes read-only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmArchive()
              }}
              disabled={
                archiveZone ? actionState[archiveZone.id] === "archive" : false
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiveZone && actionState[archiveZone.id] === "archive"
                ? "Archiving..."
                : "Archive zone"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ZoneActions({
  zone,
  actionState,
  onEdit,
  onToggleStatus,
  onArchive,
  onSnippet,
  onPerformance,
  wrap = false,
}: {
  zone: AdZone
  actionState?: ActionKind
  onEdit: () => void
  onToggleStatus: () => void
  onArchive: () => void
  onSnippet: () => void
  onPerformance: () => void
  wrap?: boolean
}) {
  const isArchived = zone.status === "ARCHIVED"
  const isBusy = !!actionState

  return (
    <div
      className={
        wrap ? "flex flex-wrap gap-2" : "flex flex-wrap justify-end gap-1.5"
      }
    >
      <Button variant="outline" size="sm" onClick={onPerformance}>
        <BarChart3 className="size-3.5" /> Performance
      </Button>
      <Button variant="outline" size="sm" onClick={onSnippet}>
        <Copy className="size-3.5" /> Snippet
      </Button>
      {!isArchived ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={isBusy}
          >
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleStatus}
            disabled={isBusy}
          >
            {actionState === "status" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : zone.status === "ACTIVE" ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
            {zone.status === "ACTIVE" ? "Pause" : "Activate"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onArchive}
            disabled={isBusy}
          >
            <Archive className="size-3.5" /> Archive
          </Button>
        </>
      ) : null}
    </div>
  )
}

function ZoneEditDialog({
  zone,
  onOpenChange,
  onSaved,
}: {
  zone: AdZone | null
  onOpenChange: (open: boolean) => void
  onSaved: (zone: AdZone) => void
}) {
  const form = useForm<z.input<typeof zoneSchema>, unknown, ZoneFormOutput>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      zoneName: "",
      width: 300,
      height: 250,
      layoutType: "banner",
    },
  })

  React.useEffect(() => {
    if (zone) {
      form.reset({
        zoneName: zone.zoneName,
        width: zone.width,
        height: zone.height,
        layoutType: zone.layoutType,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone])

  async function onSubmit(values: ZoneFormOutput) {
    if (!zone) return
    try {
      const updated = await updateAdZone(zone.id, values)
      onSaved(updated)
      toast.success(`"${updated.zoneName}" updated`)
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not update zone"
      )
    }
  }

  return (
    <Dialog open={!!zone} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit ad zone</DialogTitle>
          <DialogDescription>
            Update the name, size, or layout for this zone.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="zoneName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zone name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="width"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Width (px)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={(field.value as number | string) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (px)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={(field.value as number | string) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="layoutType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Layout type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LAYOUT_TYPES.map((layout) => (
                        <SelectItem key={layout.value} value={layout.value}>
                          {layout.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ZoneSnippetDialog({
  zone,
  onOpenChange,
}: {
  zone: AdZone | null
  onOpenChange: (open: boolean) => void
}) {
  const [snippet, setSnippet] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!zone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnippet(null)
      return
    }
    let cancelled = false
    setSnippet(null)
    setCopied(false)
    setLoading(true)
    getAdZoneSnippet(zone.id)
      .then((result) => {
        if (!cancelled) setSnippet(result.snippet)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof ApiError ? error.message : "Could not load snippet"
          )
          onOpenChange(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id])

  async function copy() {
    if (!snippet) return
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      toast.success("Snippet copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy - your browser blocked clipboard access")
    }
  }

  return (
    <Dialog open={!!zone} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Embed snippet</DialogTitle>
          <DialogDescription>
            Paste this on your site where &quot;{zone?.zoneName}&quot; should
            appear.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Textarea
            readOnly
            rows={4}
            value={snippet ?? ""}
            className="font-mono text-xs"
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={copy} disabled={!snippet}>
            {copied ? (
              <>
                <Check className="size-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copy snippet
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ZonePerformanceDialog({
  zone,
  onOpenChange,
}: {
  zone: AdZone | null
  onOpenChange: (open: boolean) => void
}) {
  const [range, setRange] = React.useState(defaultDateRange)
  const [data, setData] = React.useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(
    async (zoneId: string, startDate: string, endDate: string) => {
      setLoading(true)
      setError(null)
      try {
        const result = await getAdZonePerformance(zoneId, startDate, endDate)
        setData(result)
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Could not load performance"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  React.useEffect(() => {
    if (!zone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
      setError(null)
      return
    }
    const initial = defaultDateRange()
    setRange(initial)
    load(zone.id, initial.startDate, initial.endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id])

  const totals = data?.totals
  const hasRows = (data?.rows.length ?? 0) > 0

  return (
    <Dialog open={!!zone} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Performance - {zone?.zoneName}</DialogTitle>
          <DialogDescription>
            Impressions, clicks, and CTR for the selected date range.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="zone-perf-start">Start date</Label>
            <Input
              id="zone-perf-start"
              type="date"
              value={range.startDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, startDate: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="zone-perf-end">End date</Label>
            <Input
              id="zone-perf-end"
              type="date"
              value={range.endDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, endDate: e.target.value }))
              }
            />
          </div>
          <Button
            size="sm"
            disabled={loading || !zone}
            onClick={() => zone && load(zone.id, range.startDate, range.endDate)}
          >
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {range.startDate} to {range.endDate}
        </p>

        {loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error && !data ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {error}
          </p>
        ) : totals && hasRows ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="Impressions"
              value={totals.impressions.toLocaleString()}
            />
            <MetricTile label="Clicks" value={totals.clicks.toLocaleString()} />
            <MetricTile label="CTR" value={formatPercent(totals.ctr)} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No performance data for this date range.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
