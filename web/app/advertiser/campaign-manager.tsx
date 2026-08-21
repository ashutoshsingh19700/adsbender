"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  Archive,
  BarChart3,
  Loader2,
  Pause,
  Pencil,
  Play,
  Trash2,
  Wallet,
} from "lucide-react"

import {
  ApiError,
  archiveCampaign,
  deleteCampaign,
  getCampaignBudgetStatus,
  getCampaignPerformance,
  getCampaignSpend,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  updateCampaign,
  uploadCreativeFile,
} from "@/lib/api"
import type {
  AnalyticsResponse,
  Campaign,
  CampaignBudgetStatus,
  CampaignSpend,
} from "@/lib/types"
import { defaultDateRange, formatCurrency, formatPercent } from "@/lib/utils"
import {
  COUNTRIES,
  DEVICES,
  ARCHIVABLE_CAMPAIGN_STATUSES,
  DELETABLE_CAMPAIGN_STATUSES,
  EDITABLE_CAMPAIGN_STATUSES,
  campaignSchema,
  type CampaignFormInput,
  type CampaignFormOutput,
} from "@/app/advertiser/campaign-fields"

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
import { Checkbox } from "@/components/ui/checkbox"
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
  FormDescription,
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

type CampaignStatusValue = Campaign["status"]

const STATUS_BADGE: Record<
  CampaignStatusValue,
  "default" | "outline" | "secondary"
> = {
  DRAFT: "outline",
  PENDING_REVIEW: "outline",
  ACTIVE: "default",
  PAUSED: "outline",
  COMPLETED: "secondary",
  ARCHIVED: "secondary",
}

type ActionKind = "pause" | "resume" | "archive" | "delete"

export function CampaignManager({ refreshToken = 0 }: { refreshToken?: number }) {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([])
  const [loading, setLoading] = React.useState(true)
  const [spendById, setSpendById] = React.useState<
    Record<string, CampaignSpend | "error" | undefined>
  >({})
  const [actionState, setActionState] = React.useState<
    Record<string, ActionKind | undefined>
  >({})

  const [editCampaign, setEditCampaign] = React.useState<Campaign | null>(null)
  const [financeCampaign, setFinanceCampaign] = React.useState<Campaign | null>(
    null
  )
  const [performanceCampaign, setPerformanceCampaign] =
    React.useState<Campaign | null>(null)
  const [archiveTarget, setArchiveTarget] = React.useState<Campaign | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = React.useState<Campaign | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await listCampaigns({ pageSize: 100 })
      setCampaigns(result.campaigns)

      // Spend is fetched per-campaign on the side (not blocking the table
      // render) and streamed in as each request resolves.
      result.campaigns.forEach((campaign) => {
        getCampaignSpend(campaign.id)
          .then((spend) => {
            setSpendById((s) => ({ ...s, [campaign.id]: spend }))
          })
          .catch(() => {
            setSpendById((s) => ({ ...s, [campaign.id]: "error" }))
          })
      })
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
    load()
  }, [load, refreshToken])

  function applyUpdate(updated: Campaign) {
    setCampaigns((cs) => cs.map((c) => (c.id === updated.id ? updated : c)))
  }

  async function runAction(
    campaign: Campaign,
    kind: ActionKind,
    action: () => Promise<Campaign>
  ) {
    setActionState((s) => ({ ...s, [campaign.id]: kind }))
    try {
      const updated = await action()
      applyUpdate(updated)
      toast.success(
        `"${updated.campaignName}" ${
          kind === "pause"
            ? "paused"
            : kind === "resume"
              ? "resumed"
              : "archived"
        }`
      )
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : `Could not ${kind} campaign`
      )
    } finally {
      setActionState((s) => ({ ...s, [campaign.id]: undefined }))
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    await runAction(archiveTarget, "archive", () =>
      archiveCampaign(archiveTarget.id)
    )
    setArchiveTarget(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const campaign = deleteTarget
    setActionState((s) => ({ ...s, [campaign.id]: "delete" }))
    try {
      await deleteCampaign(campaign.id)
      setCampaigns((cs) => cs.filter((c) => c.id !== campaign.id))
      toast.success(`"${campaign.campaignName}" deleted`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not delete campaign"
      )
    } finally {
      setActionState((s) => ({ ...s, [campaign.id]: undefined }))
    }
  }

  if (loading && campaigns.length === 0) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (!loading && campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You haven&apos;t created any campaigns yet. Use the wizard above to
          submit your first one.
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
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Daily budget</TableHead>
                <TableHead className="text-right">Max CPC</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">
                    {campaign.campaignName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[campaign.status]}>
                      {campaign.status}
                    </Badge>
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
                  <TableCell className="text-right tabular-nums">
                    <SpendCell spend={spendById[campaign.id]} />
                  </TableCell>
                  <TableCell>
                    <CampaignActions
                      campaign={campaign}
                      actionState={actionState[campaign.id]}
                      onEdit={() => setEditCampaign(campaign)}
                      onPause={() =>
                        runAction(campaign, "pause", () =>
                          pauseCampaign(campaign.id)
                        )
                      }
                      onResume={() =>
                        runAction(campaign, "resume", () =>
                          resumeCampaign(campaign.id)
                        )
                      }
                      onArchive={() => setArchiveTarget(campaign)}
                      onDelete={() => setDeleteTarget(campaign)}
                      onFinancials={() => setFinanceCampaign(campaign)}
                      onPerformance={() => setPerformanceCampaign(campaign)}
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
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{campaign.campaignName}</p>
                <Badge variant={STATUS_BADGE[campaign.status]}>
                  {campaign.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="tabular-nums">
                    {formatCurrency(campaign.totalBudget)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily budget</p>
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
                <div>
                  <p className="text-xs text-muted-foreground">Spend</p>
                  <div className="tabular-nums">
                    <SpendCell spend={spendById[campaign.id]} />
                  </div>
                </div>
              </div>
              <CampaignActions
                campaign={campaign}
                actionState={actionState[campaign.id]}
                onEdit={() => setEditCampaign(campaign)}
                onPause={() =>
                  runAction(campaign, "pause", () => pauseCampaign(campaign.id))
                }
                onResume={() =>
                  runAction(campaign, "resume", () =>
                    resumeCampaign(campaign.id)
                  )
                }
                onArchive={() => setArchiveTarget(campaign)}
                onDelete={() => setDeleteTarget(campaign)}
                onFinancials={() => setFinanceCampaign(campaign)}
                onPerformance={() => setPerformanceCampaign(campaign)}
                wrap
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <CampaignEditDialog
        campaign={editCampaign}
        onOpenChange={(open) => !open && setEditCampaign(null)}
        onSaved={applyUpdate}
      />
      <CampaignFinancialsDialog
        campaign={financeCampaign}
        onOpenChange={(open) => !open && setFinanceCampaign(null)}
      />
      <CampaignPerformanceDialog
        campaign={performanceCampaign}
        onOpenChange={(open) => !open && setPerformanceCampaign(null)}
      />

      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive &quot;{archiveTarget?.campaignName}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archiving stops this campaign for good - it can&apos;t be
              resumed afterward. Its spend history and creative stay on
              record, but the campaign becomes read-only.
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
                archiveTarget
                  ? actionState[archiveTarget.id] === "archive"
                  : false
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiveTarget && actionState[archiveTarget.id] === "archive"
                ? "Archiving..."
                : "Archive campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleteTarget?.campaignName}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the draft campaign - there&apos;s no
              undo. Only draft campaigns can be deleted this way; submitted
              campaigns must be archived instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={
                deleteTarget ? actionState[deleteTarget.id] === "delete" : false
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTarget && actionState[deleteTarget.id] === "delete"
                ? "Deleting..."
                : "Delete draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SpendCell({ spend }: { spend: CampaignSpend | "error" | undefined }) {
  if (spend === undefined) {
    return <Skeleton className="ml-auto h-4 w-14" />
  }
  if (spend === "error") {
    return <span className="text-muted-foreground">-</span>
  }
  return <>{formatCurrency(spend.spendToDate)}</>
}

function CampaignActions({
  campaign,
  actionState,
  onEdit,
  onPause,
  onResume,
  onArchive,
  onDelete,
  onFinancials,
  onPerformance,
  wrap = false,
}: {
  campaign: Campaign
  actionState?: ActionKind
  onEdit: () => void
  onPause: () => void
  onResume: () => void
  onArchive: () => void
  onDelete: () => void
  onFinancials: () => void
  onPerformance: () => void
  wrap?: boolean
}) {
  const isBusy = !!actionState
  const canEdit = (EDITABLE_CAMPAIGN_STATUSES as readonly string[]).includes(
    campaign.status
  )
  const canArchive = (
    ARCHIVABLE_CAMPAIGN_STATUSES as readonly string[]
  ).includes(campaign.status)
  const canDelete = (DELETABLE_CAMPAIGN_STATUSES as readonly string[]).includes(
    campaign.status
  )

  return (
    <div
      className={
        wrap ? "flex flex-wrap gap-2" : "flex flex-wrap justify-end gap-1.5"
      }
    >
      <Button variant="outline" size="sm" onClick={onPerformance}>
        <BarChart3 className="size-3.5" /> Performance
      </Button>
      <Button variant="outline" size="sm" onClick={onFinancials}>
        <Wallet className="size-3.5" /> Financials
      </Button>
      {canEdit ? (
        <Button variant="outline" size="sm" onClick={onEdit} disabled={isBusy}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      ) : null}
      {campaign.status === "ACTIVE" ? (
        <Button variant="outline" size="sm" onClick={onPause} disabled={isBusy}>
          {actionState === "pause" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Pause className="size-3.5" />
          )}
          Pause
        </Button>
      ) : null}
      {campaign.status === "PAUSED" ? (
        <Button variant="outline" size="sm" onClick={onResume} disabled={isBusy}>
          {actionState === "resume" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          Resume
        </Button>
      ) : null}
      {canArchive ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={onArchive}
          disabled={isBusy}
        >
          <Archive className="size-3.5" /> Archive
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isBusy}
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
      ) : null}
    </div>
  )
}

function CampaignEditDialog({
  campaign,
  onOpenChange,
  onSaved,
}: {
  campaign: Campaign | null
  onOpenChange: (open: boolean) => void
  onSaved: (campaign: Campaign) => void
}) {
  const form = useForm<CampaignFormInput, unknown, CampaignFormOutput>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaignName: "",
      totalBudget: 100,
      dailyBudget: 20,
      maxCpc: 0.5,
      targetCountries: [],
      targetDevices: [],
      creativeType: "image",
      creativeUrl: "",
      creativeHtml: "",
      destinationUrl: "",
      notes: "",
    },
  })

  React.useEffect(() => {
    if (campaign) {
      form.reset({
        campaignName: campaign.campaignName,
        totalBudget: Number(campaign.totalBudget),
        dailyBudget: Number(campaign.dailyBudget),
        maxCpc: Number(campaign.maxCpc),
        targetCountries: campaign.targetCountries,
        targetDevices: campaign.targetDevices,
        creativeType: campaign.creativeType,
        creativeUrl: campaign.creativeUrl ?? "",
        creativeHtml: campaign.creativeHtml ?? "",
        destinationUrl: campaign.destinationUrl ?? "",
        notes: campaign.notes ?? "",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign])

  const creativeType = form.watch("creativeType")
  const [uploading, setUploading] = React.useState(false)

  // Mirrors campaign-wizard.tsx's handleFileSelected — see the comment
  // there for why the size check is duplicated from the backend.
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Image is too large (max 5 MB)")
      return
    }

    setUploading(true)
    try {
      const { url } = await uploadCreativeFile(file)
      form.setValue("creativeUrl", url, {
        shouldValidate: true,
        shouldDirty: true,
      })
      toast.success("Image uploaded")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit(values: CampaignFormOutput) {
    if (!campaign) return
    try {
      const updated = await updateCampaign(campaign.id, values)
      onSaved(updated)
      toast.success(`"${updated.campaignName}" updated`)
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not update campaign"
      )
    }
  }

  return (
    <Dialog open={!!campaign} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogDescription>
            {campaign
              ? `Editing is only available while a campaign is ${EDITABLE_CAMPAIGN_STATUSES.join(" or ")}.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="campaignName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="totalBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total budget ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
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
                name="dailyBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily budget ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
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
                name="maxCpc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max CPC ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
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
              name="targetCountries"
              render={() => (
                <FormItem>
                  <FormLabel>Target countries</FormLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {COUNTRIES.map((country) => (
                      <FormField
                        key={country.value}
                        control={form.control}
                        name="targetCountries"
                        render={({ field }) => {
                          const values = field.value ?? []
                          const checked = values.includes(country.value)
                          return (
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  field.onChange(
                                    isChecked
                                      ? [...values, country.value]
                                      : values.filter(
                                          (v) => v !== country.value
                                        )
                                  )
                                }}
                              />
                              {country.label}
                            </label>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetDevices"
              render={() => (
                <FormItem>
                  <FormLabel>Target devices</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {DEVICES.map((device) => (
                      <FormField
                        key={device.value}
                        control={form.control}
                        name="targetDevices"
                        render={({ field }) => {
                          const values = field.value ?? []
                          const checked = values.includes(device.value)
                          return (
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  field.onChange(
                                    isChecked
                                      ? [...values, device.value]
                                      : values.filter(
                                          (v) => v !== device.value
                                        )
                                  )
                                }}
                              />
                              {device.label}
                            </label>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="creativeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Creative type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {creativeType === "image" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <FormLabel>Upload image</FormLabel>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    disabled={uploading}
                    onChange={handleFileSelected}
                  />
                  <p className="text-sm text-muted-foreground">
                    {uploading
                      ? "Uploading..."
                      : "PNG, JPEG, GIF or WEBP, up to 5 MB. Fills the URL below automatically — or paste one yourself."}
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="creativeUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creative URL</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destinationUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://fakirefashion.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Where people land when they click this ad.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="creativeHtml"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creative HTML</FormLabel>
                      <FormControl>
                        <Textarea rows={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destinationUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination URL (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://fakirefashion.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        For reference only — your HTML above should already
                        include its own link(s), since this won&apos;t be
                        wrapped around it automatically.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormDescription>
                    Internal notes for the review team.
                  </FormDescription>
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

function CampaignFinancialsDialog({
  campaign,
  onOpenChange,
}: {
  campaign: Campaign | null
  onOpenChange: (open: boolean) => void
}) {
  const [spend, setSpend] = React.useState<CampaignSpend | null>(null)
  const [budget, setBudget] = React.useState<CampaignBudgetStatus | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!campaign) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpend(null)
      setBudget(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled([
      getCampaignSpend(campaign.id),
      getCampaignBudgetStatus(campaign.id),
    ]).then(([spendResult, budgetResult]) => {
      if (cancelled) return
      if (spendResult.status === "fulfilled") {
        setSpend(spendResult.value)
      } else {
        setSpend(null)
      }
      if (budgetResult.status === "fulfilled") {
        setBudget(budgetResult.value)
      } else {
        setBudget(null)
      }
      if (spendResult.status === "rejected" && budgetResult.status === "rejected") {
        const message =
          spendResult.reason instanceof ApiError
            ? spendResult.reason.message
            : "Could not load financial data"
        setError(message)
        toast.error(message)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [campaign])

  return (
    <Dialog open={!!campaign} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Financials - {campaign?.campaignName}</DialogTitle>
          <DialogDescription>
            Spend and budget status for this campaign.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {error}
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-medium">Spend</h3>
              {spend ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricTile
                    label="Total budget"
                    value={formatCurrency(spend.totalBudget)}
                  />
                  <MetricTile
                    label="Spend to date"
                    value={formatCurrency(spend.spendToDate)}
                  />
                  <MetricTile
                    label="Remaining"
                    value={formatCurrency(spend.remainingBudget)}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No spend data available.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Budget status</h3>
              {budget ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricTile
                      label="Spent today"
                      value={formatCurrency(budget.spentToday)}
                    />
                    <MetricTile
                      label="Remaining today"
                      value={formatCurrency(budget.remainingToday)}
                    />
                    <MetricTile
                      label="Spent total"
                      value={formatCurrency(budget.spentTotal)}
                    />
                    <MetricTile
                      label="Remaining total"
                      value={formatCurrency(budget.remainingTotal)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {budget.dailyBudgetExhausted ? (
                      <Badge variant="destructive">
                        Daily budget exhausted
                      </Badge>
                    ) : null}
                    {budget.totalBudgetExhausted ? (
                      <Badge variant="destructive">
                        Total budget exhausted
                      </Badge>
                    ) : null}
                    {!budget.dailyBudgetExhausted &&
                    !budget.totalBudgetExhausted ? (
                      <Badge variant="outline">Within budget</Badge>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No budget status available.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CampaignPerformanceDialog({
  campaign,
  onOpenChange,
}: {
  campaign: Campaign | null
  onOpenChange: (open: boolean) => void
}) {
  const [range, setRange] = React.useState(defaultDateRange)
  const [data, setData] = React.useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(
    async (campaignId: string, startDate: string, endDate: string) => {
      setLoading(true)
      setError(null)
      try {
        const result = await getCampaignPerformance(
          campaignId,
          startDate,
          endDate
        )
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
    if (!campaign) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
      setError(null)
      return
    }
    const initial = defaultDateRange()
    setRange(initial)
    load(campaign.id, initial.startDate, initial.endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id])

  const totals = data?.totals
  const hasRows = (data?.rows.length ?? 0) > 0
  const cpc = totals && totals.clicks > 0 ? totals.spend / totals.clicks : null

  return (
    <Dialog open={!!campaign} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Performance - {campaign?.campaignName}</DialogTitle>
          <DialogDescription>
            Impressions, clicks, CTR, spend, and CPC for the selected date
            range.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-perf-start">Start date</Label>
            <Input
              id="campaign-perf-start"
              type="date"
              value={range.startDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, startDate: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-perf-end">End date</Label>
            <Input
              id="campaign-perf-end"
              type="date"
              value={range.endDate}
              onChange={(e) =>
                setRange((r) => ({ ...r, endDate: e.target.value }))
              }
            />
          </div>
          <Button
            size="sm"
            disabled={loading || !campaign}
            onClick={() =>
              campaign && load(campaign.id, range.startDate, range.endDate)
            }
          >
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {range.startDate} to {range.endDate}
        </p>

        {loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
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
            <MetricTile label="Spend" value={formatCurrency(totals.spend)} />
            <MetricTile
              label="CPC"
              value={cpc !== null ? formatCurrency(cpc) : "-"}
            />
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
