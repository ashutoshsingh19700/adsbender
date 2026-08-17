import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Compact metric tile used at the top of every dashboard (Advertiser
// Studio, Publisher Portal, Admin Console) so the "how is this account
// doing right now" summary always looks the same regardless of role.
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
  icon?: LucideIcon
  loading?: boolean
  tone?: "default" | "positive" | "warning"
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-20" />
          ) : (
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">
              {value}
            </p>
          )}
          {hint ? (
            <p
              className={cn(
                "mt-1 text-xs",
                tone === "positive" && "text-emerald-600",
                tone === "warning" && "text-amber-600",
                tone === "default" && "text-muted-foreground"
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <Icon className="size-4.5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
