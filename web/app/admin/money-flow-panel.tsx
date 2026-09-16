"use client"

import * as React from "react"
import { toast } from "sonner"
import { ArrowRight, Percent } from "lucide-react"

import { adminGetRevenueBreakdown, ApiError } from "@/lib/api"
import type { RevenueBreakdown } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Master-admin-only: answers "how exactly is the amount being deducted from
// the advertiser and paid to the publisher, and what does the platform keep
// by default" - both as a plain-English formula/worked example, and as real
// recently-billed ledger pairs (see AdminService.getRevenueBreakdown).
export function MoneyFlowPanel() {
  const [data, setData] = React.useState<RevenueBreakdown | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    adminGetRevenueBreakdown()
      .then((result) => setData(result))
      .catch((error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not load the revenue breakdown"
        )
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <p className="py-12 text-center text-sm font-medium text-foreground/75">
        Could not load the revenue breakdown.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="size-4" />
            How the platform cut works
          </CardTitle>
          <CardDescription>{data.explanation}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="text-center">
              <p className="text-xs font-medium text-foreground/75">
                Advertiser is charged
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(data.worked_example.advertiserCharged)}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 font-medium text-foreground/75" />
            <div className="text-center">
              <p className="text-xs font-medium text-foreground/75">
                Publisher is paid ({data.publisherSharePercent}%)
              </p>
              <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.worked_example.publisherPaid)}
              </p>
            </div>
            <span className="font-medium text-foreground/75">+</span>
            <div className="text-center">
              <p className="text-xs font-medium text-foreground/75">
                Platform keeps ({data.platformFeePercent}%)
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(data.worked_example.platformKept)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs font-medium text-foreground/75">
            Current platform fee: <strong>{data.platformFeeBps} bps</strong> (
            {data.platformFeePercent}%). Change it under Pricing →
            Platform fee.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent billed events</CardTitle>
          <CardDescription>
            The last {data.recentEvents.length} ad-spend events, each with the
            exact advertiser charge, publisher payout, and platform cut it
            produced.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length === 0 ? (
            <p className="py-12 text-center text-sm font-medium text-foreground/75">
              No billed events yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead>Publisher</TableHead>
                    <TableHead className="text-right">Charged</TableHead>
                    <TableHead className="text-right">Paid out</TableHead>
                    <TableHead className="text-right">Platform kept</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentEvents.map((event, i) => (
                    <TableRow key={event.referenceId ?? i}>
                      <TableCell className="whitespace-nowrap text-sm font-medium text-foreground/75">
                        {new Date(event.occurredAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.advertiser?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.publisher?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(event.advertiserCharged)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {event.publisherPaid !== null
                          ? formatCurrency(event.publisherPaid)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {event.platformKept !== null
                          ? formatCurrency(event.platformKept)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {event.settled ? (
                          <Badge variant="secondary">Settled</Badge>
                        ) : (
                          <Badge variant="destructive">
                            Publisher credit pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
