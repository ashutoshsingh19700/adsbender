"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, X } from "lucide-react"

import {
  adminApproveCampaign,
  adminListCampaigns,
  adminRejectCampaign,
  ApiError,
} from "@/lib/api"
import type { AdminCampaign, CampaignStatus } from "@/lib/types"
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

const STATUS_FILTERS: { value: CampaignStatus | "ALL"; label: string }[] = [
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "DRAFT", label: "Draft" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
]

export function CampaignReviewPanel({
  onCampaignReviewed,
}: {
  onCampaignReviewed?: () => void
} = {}) {
  const [statusFilter, setStatusFilter] = React.useState<
    CampaignStatus | "ALL"
  >("PENDING_REVIEW")
  const [campaigns, setCampaigns] = React.useState<AdminCampaign[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionState, setActionState] = React.useState<
    Record<string, "approve" | "reject" | undefined>
  >({})

  const [approveTarget, setApproveTarget] = React.useState<AdminCampaign | null>(
    null
  )
  const [rejectTarget, setRejectTarget] = React.useState<AdminCampaign | null>(
    null
  )
  const [rejectReason, setRejectReason] = React.useState("")

  const load = React.useCallback(async (status: CampaignStatus | "ALL") => {
    setLoading(true)
    try {
      const result = await adminListCampaigns({
        pageSize: 100,
        status: status === "ALL" ? undefined : status,
      })
      setCampaigns(result.campaigns)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load campaigns"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(statusFilter)
  }, [load, statusFilter])

  function applyUpdate(id: string, patch: Partial<AdminCampaign>) {
    setCampaigns((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function confirmApprove() {
    if (!approveTarget) return
    const campaign = approveTarget
    setActionState((s) => ({ ...s, [campaign.id]: "approve" }))
    try {
      const updated = await adminApproveCampaign(campaign.id)
      applyUpdate(campaign.id, { status: updated.status })
      toast.success(`"${updated.campaignName}" approved and is now ACTIVE`)
      setApproveTarget(null)
      onCampaignReviewed?.()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not approve campaign"
      )
    } finally {
      setActionState((s) => ({ ...s, [campaign.id]: undefined }))
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return
    const campaign = rejectTarget
    setActionState((s) => ({ ...s, [campaign.id]: "reject" }))
    try {
      const updated = await adminRejectCampaign(
        campaign.id,
        rejectReason.trim() || undefined
      )
      applyUpdate(campaign.id, { status: updated.status })
      toast.success(`"${updated.campaignName}" rejected`)
      setRejectTarget(null)
      setRejectReason("")
      onCampaignReviewed?.()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not reject campaign"
      )
    } finally {
      setActionState((s) => ({ ...s, [campaign.id]: undefined }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="campaign-status-filter">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CampaignStatus | "ALL")}
          >
            <SelectTrigger id="campaign-status-filter" className="w-48">
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

      {loading && campaigns.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !loading && campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No campaigns match this filter.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Daily</TableHead>
                    <TableHead className="text-right">Max CPC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        {campaign.campaignName}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{campaign.advertiser.name}</div>
                        <div className="text-muted-foreground">
                          {campaign.advertiser.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(campaign.totalBudget)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(campaign.dailyBudget)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(campaign.maxCpc)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[campaign.status]}>
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <ReviewActions
                          campaign={campaign}
                          busy={!!actionState[campaign.id]}
                          onApprove={() => setApproveTarget(campaign)}
                          onReject={() => setRejectTarget(campaign)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="grid gap-3 sm:hidden">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{campaign.campaignName}</p>
                      <p className="text-sm text-muted-foreground">
                        {campaign.advertiser.name} ·{" "}
                        {campaign.advertiser.email}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[campaign.status]}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="tabular-nums">
                        {formatCurrency(campaign.totalBudget)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Daily</p>
                      <p className="tabular-nums">
                        {formatCurrency(campaign.dailyBudget)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max CPC</p>
                      <p className="tabular-nums">
                        {formatCurrency(campaign.maxCpc)}
                      </p>
                    </div>
                  </div>
                  <ReviewActions
                    campaign={campaign}
                    busy={!!actionState[campaign.id]}
                    onApprove={() => setApproveTarget(campaign)}
                    onReject={() => setRejectTarget(campaign)}
                    wrap
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve &quot;{approveTarget?.campaignName}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This reserves the full{" "}
              {approveTarget ? formatCurrency(approveTarget.totalBudget) : ""}{" "}
              budget out of {approveTarget?.advertiser.name}&apos;s available
              wallet balance and makes the campaign go live immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmApprove()
              }}
              disabled={
                approveTarget
                  ? actionState[approveTarget.id] === "approve"
                  : false
              }
            >
              {approveTarget && actionState[approveTarget.id] === "approve"
                ? "Approving..."
                : "Approve & activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject &quot;{rejectTarget?.campaignName}&quot;?
            </DialogTitle>
            <DialogDescription>
              The campaign is archived and the advertiser can see this reason.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Creative URL is not accessible"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={
                rejectTarget ? actionState[rejectTarget.id] === "reject" : false
              }
            >
              {rejectTarget && actionState[rejectTarget.id] === "reject"
                ? "Rejecting..."
                : "Reject campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReviewActions({
  campaign,
  busy,
  onApprove,
  onReject,
  wrap = false,
}: {
  campaign: AdminCampaign
  busy: boolean
  onApprove: () => void
  onReject: () => void
  wrap?: boolean
}) {
  if (campaign.status !== "PENDING_REVIEW") {
    return <span className="text-sm text-muted-foreground">-</span>
  }

  return (
    <div
      className={wrap ? "flex flex-wrap gap-2" : "flex justify-end gap-1.5"}
    >
      <Button size="sm" onClick={onApprove} disabled={busy}>
        <Check className="size-3.5" /> Approve
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onReject}
        disabled={busy}
      >
        <X className="size-3.5" /> Reject
      </Button>
    </div>
  )
}
