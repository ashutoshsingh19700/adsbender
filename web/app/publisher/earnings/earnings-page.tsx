"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  ApiError,
  getWalletSummary,
  listPayouts,
  listWalletTransactions,
  requestPayout,
} from "@/lib/api"
import type {
  Payout,
  PayoutStatus,
  PublisherWalletSummary,
  TransactionType,
  WalletTransaction,
} from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const TRANSACTION_LABELS: Record<TransactionType, string> = {
  DEPOSIT: "Deposit",
  CAMPAIGN_RESERVATION: "Budget reserved",
  AD_SPEND: "Ad spend",
  REFUND: "Refund",
  PUBLISHER_EARNING: "Earning",
  PAYOUT_REQUEST: "Payout requested",
  PAYOUT_COMPLETED: "Payout completed",
  PAYOUT_FAILED: "Payout failed",
  ADJUSTMENT: "Adjustment",
}

const CREDIT_TYPES: TransactionType[] = ["PUBLISHER_EARNING"]

const PAYOUT_BADGE: Record<
  PayoutStatus,
  "outline" | "secondary" | "destructive"
> = {
  REQUESTED: "outline",
  PROCESSING: "outline",
  COMPLETED: "secondary",
  FAILED: "destructive",
}

const payoutRequestSchema = z.object({
  amount: z.coerce.number().min(0.01, "Enter an amount"),
})

type PayoutRequestFormInput = z.input<typeof payoutRequestSchema>
type PayoutRequestFormOutput = z.output<typeof payoutRequestSchema>

export function PublisherEarningsPage() {
  const [summary, setSummary] = React.useState<PublisherWalletSummary | null>(
    null
  )
  const [transactions, setTransactions] = React.useState<WalletTransaction[]>(
    []
  )
  const [payouts, setPayouts] = React.useState<Payout[]>([])
  const [loading, setLoading] = React.useState(true)

  const payoutForm = useForm<
    PayoutRequestFormInput,
    unknown,
    PayoutRequestFormOutput
  >({
    resolver: zodResolver(payoutRequestSchema),
    defaultValues: { amount: 20 },
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [summaryResult, transactionsResult, payoutsResult] =
        await Promise.all([
          getWalletSummary() as Promise<PublisherWalletSummary>,
          listWalletTransactions({ pageSize: 20 }),
          listPayouts({ pageSize: 20 }),
        ])
      setSummary(summaryResult)
      setTransactions(transactionsResult.transactions)
      setPayouts(payoutsResult.payouts)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load earnings"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onRequestPayout(values: PayoutRequestFormOutput) {
    try {
      const payout = await requestPayout({ amount: values.amount })
      toast.success(
        `Payout of ${formatCurrency(payout.amount)} requested (${payout.status})`
      )
      payoutForm.reset({ amount: 20 })
      await load()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Payout request failed"
      )
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
        <p className="text-muted-foreground">
          Track what you&apos;ve earned and request payouts.
        </p>
      </div>

      {loading && !summary ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-4">
          <BalanceTile
            label="Current earnings"
            value={summary?.currentEarnings}
          />
          <BalanceTile
            label="Available"
            value={summary?.availableEarnings}
          />
          <BalanceTile
            label="Pending"
            value={summary?.pendingEarnings}
          />
          <BalanceTile
            label="Total earned"
            value={summary?.totalEarned}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Request payout</CardTitle>
            <CardDescription>
              Minimum payout is{" "}
              {summary
                ? formatCurrency(summary.minimumPayoutThreshold)
                : "…"}
              . No payment provider is configured yet, so requests are
              queued for manual processing.
            </CardDescription>
          </CardHeader>
          <Form {...payoutForm}>
            <form onSubmit={payoutForm.handleSubmit(onRequestPayout)}>
              <CardContent>
                <FormField
                  control={payoutForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          {...field}
                          value={(field.value as number | string) ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Only your available balance can be paid out - pending
                        earnings must clear first.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={payoutForm.formState.isSubmitting}
                >
                  {payoutForm.formState.isSubmitting
                    ? "Requesting..."
                    : "Request payout"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout history</CardTitle>
            <CardDescription>Status of your payout requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length ? (
                  payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(payout.requestedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(payout.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PAYOUT_BADGE[payout.status]}>
                          {payout.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No payouts yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>Every ledgered event on your wallet.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length ? (
                transactions.map((transaction) => {
                  const isCredit = CREDIT_TYPES.includes(transaction.type)
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {TRANSACTION_LABELS[transaction.type]}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.description ?? "-"}
                      </TableCell>
                      <TableCell
                        className={
                          "text-right tabular-nums " +
                          (isCredit ? "text-emerald-600 dark:text-emerald-400" : "")
                        }
                      >
                        {isCredit ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.status === "COMPLETED"
                              ? "secondary"
                              : transaction.status === "FAILED"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function BalanceTile({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {value !== undefined ? formatCurrency(value) : "-"}
        </p>
      </CardContent>
    </Card>
  )
}
