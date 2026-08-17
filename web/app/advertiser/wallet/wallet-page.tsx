"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  ApiError,
  depositFunds,
  getWalletSummary,
  listWalletTransactions,
} from "@/lib/api"
import type {
  AdvertiserWalletSummary,
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

const depositSchema = z.object({
  amount: z.coerce.number().min(0.01, "Enter an amount greater than 0"),
})

type DepositFormInput = z.input<typeof depositSchema>
type DepositFormOutput = z.output<typeof depositSchema>

const TRANSACTION_LABELS: Record<TransactionType, string> = {
  DEPOSIT: "Deposit",
  CAMPAIGN_RESERVATION: "Budget reserved",
  AD_SPEND: "Ad spend",
  REFUND: "Refund",
  PUBLISHER_EARNING: "Publisher earning",
  PAYOUT_REQUEST: "Payout requested",
  PAYOUT_COMPLETED: "Payout completed",
  PAYOUT_FAILED: "Payout failed",
  ADJUSTMENT: "Adjustment",
}

const CREDIT_TYPES: TransactionType[] = ["DEPOSIT", "REFUND"]

export function AdvertiserWalletPage() {
  const [summary, setSummary] = React.useState<AdvertiserWalletSummary | null>(
    null
  )
  const [transactions, setTransactions] = React.useState<WalletTransaction[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)

  const form = useForm<DepositFormInput, unknown, DepositFormOutput>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 50 },
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [summaryResult, transactionsResult] = await Promise.all([
        getWalletSummary() as Promise<AdvertiserWalletSummary>,
        listWalletTransactions({ pageSize: 20 }),
      ])
      setSummary(summaryResult)
      setTransactions(transactionsResult.transactions)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load wallet"
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

  async function onDeposit(values: DepositFormOutput) {
    try {
      const result = await depositFunds({ amount: values.amount })
      toast.success(`Added ${formatCurrency(result.amount)} to your wallet`)
      form.reset({ amount: 50 })
      await load()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Deposit failed"
      )
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="text-muted-foreground">
          Manage your advertiser balance, top-ups, and campaign spending.
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
            label="Current balance"
            value={summary?.currentBalance}
          />
          <BalanceTile
            label="Available"
            value={summary?.availableBalance}
          />
          <BalanceTile
            label="Reserved for campaigns"
            value={summary?.reservedBalance}
          />
          <BalanceTile
            label="Total spent"
            value={summary?.totalSpent}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add funds</CardTitle>
            <CardDescription>
              Top up your wallet to fund campaign budgets.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onDeposit)}>
              <CardContent>
                <FormField
                  control={form.control}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Adding funds..." : "Add funds"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign spending</CardTitle>
            <CardDescription>
              Budget reserved and spent per campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.campaignSpending.length ? (
                  summary.campaignSpending.map((campaign) => (
                    <TableRow key={campaign.campaignId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{campaign.campaignName}</span>
                          <Badge variant="outline">{campaign.status}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(campaign.totalBudget)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(campaign.reserved)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(campaign.spent)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(campaign.remaining)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No campaigns yet.
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
