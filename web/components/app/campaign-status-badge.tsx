import { cn } from "@/lib/utils"
import type { Campaign } from "@/lib/types"

type CampaignStatus = Campaign["status"]

// Colour + dot per status, shared by every screen that lists campaigns
// (advertiser campaign manager, advertiser statistics) so a status reads
// the same way everywhere instead of drifting per page.
const STATUS_STYLES: Record<CampaignStatus, { label: string; dot: string; classes: string }> = {
  DRAFT: {
    label: "Draft",
    dot: "bg-zinc-400",
    classes: "bg-zinc-100 text-zinc-600",
  },
  PENDING_REVIEW: {
    label: "Pending review",
    dot: "bg-amber-500",
    classes: "bg-amber-100 text-amber-800",
  },
  ACTIVE: {
    label: "Active",
    dot: "bg-emerald-500",
    classes: "bg-emerald-100 text-emerald-700",
  },
  PAUSED: {
    label: "Paused",
    dot: "bg-zinc-400",
    classes: "bg-zinc-100 text-zinc-600",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-blue-500",
    classes: "bg-blue-100 text-blue-700",
  },
  ARCHIVED: {
    label: "Archived",
    dot: "bg-zinc-400",
    classes: "bg-zinc-100 text-zinc-500",
  },
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        style.classes
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}
