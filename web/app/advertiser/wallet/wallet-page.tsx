"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  ApiError,
  createRazorpayOrder,
  getWalletSummary,
  listWalletTransactions,
  verifyRazorpayPayment,
} from "@/lib/api"
import type {
  AdvertiserWalletSummary,
  TransactionType,
  WalletTransaction,
} from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpay"
import { useAuth } from "@/app/providers/auth-provider"
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

const depositSchema = z.object({
  amount: z.coerce.number().min(1, "Enter an amount of at least $1"),
  payCurrency: z.enum(["INR", "USD"]),
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
  const { user } = useAuth()
  const [summary, setSummary] = React.useState<AdvertiserWalletSummary | null>(
    null
  )
  const [transactions, setTransactions] = React.useState<WalletTransaction[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [payingViaCheckout, setPayingViaCheckout] = React.useState(false)

  const form = useForm<DepositFormInput, unknown, DepositFormOutput>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 50, payCurrency: "INR" },
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
    setPayingViaCheckout(true)
    try {
      const order = await createRazorpayOrder({
        amountUsd: values.amount,
        payCurrency: values.payCurrency,
      })

      await loadRazorpayCheckout()

      const result = await openRazorpayCheckout({
        key: order.razorpayKeyId,
        order_id: order.razorpayOrderId,
        amount: Math.round(Number(order.payAmount) * 100),
        currency: order.payCurrency,
        name: "Ad Network",
        description: "Wallet top-up",
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#0f172a" },
      })

      await verifyRazorpayPayment({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      })

      toast.success(`Added ${formatCurrency(order.creditAmountUsd)} to your wallet`)
      form.reset({ amount: 50, payCurrency: values.payCurrency })
      await load()
    } catch (error) {
      if (error instanceof Error && error.message === "DISMISSED") {
        // User closed the Razorpay modal without paying - not an error.
        return
      }
      toast.error(
        error instanceof ApiError ? error.message : "Payment failed"
      )
    } finally {
      setPayingViaCheckout(false)
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
              <CardContent className="space-y-4">
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
                          min="1"
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
                  name="payCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pay with</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="INR">
                            Indian Rupee (INR)
                          </SelectItem>
                          <SelectItem value="USD">US Dollar (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || payingViaCheckout}
                >
                  {payingViaCheckout ? "Processing payment..." : "Add funds"}
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
