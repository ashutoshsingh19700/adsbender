import type { ComponentType } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Compact metric tile used at the top of every dashboard (Advertiser
// Studio, Publisher Portal, Admin Console) so the "how is this account
// doing right now" summary always looks the same regardless of role.
const TONE_ICON_STYLES: Record<"default" | "positive" | "warning", string> = {
  default: "bg-blue-50 text-blue-600",
  positive: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading = false,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  icon?: ComponentType<{ className?: string }>
  loading?: boolean
  tone?: "default" | "positive" | "warning"
}) {
  return (
    <Card className="rounded-2xl border-none py-0 shadow-sm ring-1 ring-border">
      <CardContent className="flex items-start justify-between gap-3 py-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground/75">{label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          )}
          {hint ? (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                tone === "positive" && "text-emerald-600",
                tone === "warning" && "text-amber-600",
                tone === "default" && "text-foreground/75"
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              TONE_ICON_STYLES[tone]
            )}
          >
            <Icon className="size-4.5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
