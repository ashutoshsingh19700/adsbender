"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, X } from "lucide-react"

import {
  adminCompletePayout,
  adminFailPayout,
  adminListPayouts,
  ApiError,
} from "@/lib/api"
import type { AdminPayout, PayoutStatus } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

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

const STATUS_BADGE: Record<
  PayoutStatus,
  "outline" | "secondary" | "destructive"
> = {
  REQUESTED: "outline",
  PROCESSING: "outline",
  COMPLETED: "secondary",
  FAILED: "destructive",
}

const STATUS_FILTERS: { value: PayoutStatus | "ALL"; label: string }[] = [
  { value: "PROCESSING", label: "Processing" },
  { value: "ALL", label: "All statuses" },
  { value: "REQUESTED", label: "Requested" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
]

const TERMINAL: PayoutStatus[] = ["COMPLETED", "FAILED"]

export function PayoutsPanel() {
  const [statusFilter, setStatusFilter] = React.useState<
    PayoutStatus | "ALL"
  >("PROCESSING")
  const [payouts, setPayouts] = React.useState<AdminPayout[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionState, setActionState] = React.useState<
    Record<string, "complete" | "fail" | undefined>
  >({})

  const [completeTarget, setCompleteTarget] = React.useState<AdminPayout | null>(
    null
  )
  const [failTarget, setFailTarget] = React.useState<AdminPayout | null>(null)
  const [providerRef, setProviderRef] = React.useState("")
  const [failReason, setFailReason] = React.useState("")

  const load = React.useCallback(async (status: PayoutStatus | "ALL") => {
    setLoading(true)
    try {
      const result = await adminListPayouts({
        pageSize: 100,
        status: status === "ALL" ? undefined : status,
      })
      setPayouts(result.payouts)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load payouts"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(statusFilter)
  }, [load, statusFilter])

  function applyUpdate(id: string, patch: Partial<AdminPayout>) {
    setPayouts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  async function confirmComplete() {
    if (!completeTarget) return
    const payout = completeTarget
    setActionState((s) => ({ ...s, [payout.id]: "complete" }))
    try {
      const updated = await adminCompletePayout(
        payout.id,
        providerRef.trim() || undefined
      )
      applyUpdate(payout.id, {
        status: updated.status,
        providerRef: updated.providerRef,
        processedAt: updated.processedAt,
      })
      toast.success(
        `Payout of ${formatCurrency(updated.amount)} marked complete`
      )
      setCompleteTarget(null)
      setProviderRef("")
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not complete payout"
      )
    } finally {
      setActionState((s) => ({ ...s, [payout.id]: undefined }))
    }
  }

  async function confirmFail() {
    if (!failTarget) return
    const payout = failTarget
    setActionState((s) => ({ ...s, [payout.id]: "fail" }))
    try {
      const updated = await adminFailPayout(
        payout.id,
        failReason.trim() || undefined
      )
      applyUpdate(payout.id, {
        status: updated.status,
        failureReason: updated.failureReason,
        processedAt: updated.processedAt,
      })
      toast.success(`Payout of ${formatCurrency(updated.amount)} marked failed`)
      setFailTarget(null)
      setFailReason("")
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not fail payout"
      )
    } finally {
      setActionState((s) => ({ ...s, [payout.id]: undefined }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="payout-status-filter">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PayoutStatus | "ALL")}
          >
            <SelectTrigger id="payout-status-filter" className="w-48">
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

      {loading && payouts.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !loading && payouts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No payouts match this filter.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Publisher</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="text-sm">
                        <div>{payout.wallet.user.name}</div>
                        <div className="text-muted-foreground">
                          {payout.wallet.user.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(payout.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[payout.status]}>
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(payout.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <PayoutActions
                          payout={payout}
                          busy={!!actionState[payout.id]}
                          onComplete={() => setCompleteTarget(payout)}
                          onFail={() => setFailTarget(payout)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="grid gap-3 sm:hidden">
            {payouts.map((payout) => (
              <Card key={payout.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{payout.wallet.user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {payout.wallet.user.email}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[payout.status]}>
                      {payout.status}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(payout.amount)}
                  </p>
                  <PayoutActions
                    payout={payout}
                    busy={!!actionState[payout.id]}
                    onComplete={() => setCompleteTarget(payout)}
                    onFail={() => setFailTarget(payout)}
                    wrap
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog
        open={!!completeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCompleteTarget(null)
            setProviderRef("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark payout complete?</DialogTitle>
            <DialogDescription>
              Confirms{" "}
              {completeTarget ? formatCurrency(completeTarget.amount) : ""} was
              actually transferred to {completeTarget?.wallet.user.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="provider-ref">Provider reference (optional)</Label>
            <Input
              id="provider-ref"
              value={providerRef}
              onChange={(e) => setProviderRef(e.target.value)}
              placeholder="e.g. bank transfer ID"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCompleteTarget(null)
                setProviderRef("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmComplete}
              disabled={
                completeTarget
                  ? actionState[completeTarget.id] === "complete"
                  : false
              }
            >
              {completeTarget && actionState[completeTarget.id] === "complete"
                ? "Saving..."
                : "Mark complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!failTarget}
        onOpenChange={(open) => {
          if (!open) {
            setFailTarget(null)
            setFailReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark payout failed?</DialogTitle>
            <DialogDescription>
              The held funds (
              {failTarget ? formatCurrency(failTarget.amount) : ""}) are
              returned to {failTarget?.wallet.user.name}&apos;s available
              balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="fail-reason">Reason (optional)</Label>
            <Textarea
              id="fail-reason"
              rows={3}
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="e.g. Bank account details invalid"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFailTarget(null)
                setFailReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmFail}
              disabled={
                failTarget ? actionState[failTarget.id] === "fail" : false
              }
            >
              {failTarget && actionState[failTarget.id] === "fail"
                ? "Saving..."
                : "Mark failed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PayoutActions({
  payout,
  busy,
  onComplete,
  onFail,
  wrap = false,
}: {
  payout: AdminPayout
  busy: boolean
  onComplete: () => void
  onFail: () => void
  wrap?: boolean
}) {
  if (TERMINAL.includes(payout.status)) {
    return <span className="text-sm text-muted-foreground">-</span>
  }

  return (
    <div
      className={wrap ? "flex flex-wrap gap-2" : "flex justify-end gap-1.5"}
    >
      <Button size="sm" onClick={onComplete} disabled={busy}>
        <Check className="size-3.5" /> Complete
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onFail}
        disabled={busy}
      >
        <X className="size-3.5" /> Fail
      </Button>
    </div>
  )
}
