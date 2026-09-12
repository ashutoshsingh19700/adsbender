"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  ApiError,
  capturePayPalPayment,
  createPayPalOrder,
  createRazorpayOrder,
  getWalletSummary,
  listWalletTransactions,
  verifyRazorpayPayment,
  type CreatePayPalOrderResult,
} from "@/lib/api"
import type {
  AdvertiserWalletSummary,
  TransactionType,
  WalletTransaction,
} from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { loadPayPalSdk, renderPayPalButtons } from "@/lib/paypal"
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpay"
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

type Gateway = "paypal" | "razorpay"
type RazorpayCurrency = "INR" | "USD"

const depositSchema = z.object({
  amount: z.coerce.number().min(1, "Enter an amount of at least $1"),
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
  const [creatingOrder, setCreatingOrder] = React.useState(false)
  const [gateway, setGateway] = React.useState<Gateway>("paypal")
  const [razorpayCurrency, setRazorpayCurrency] =
    React.useState<RazorpayCurrency>("INR")
  const [pendingOrder, setPendingOrder] =
    React.useState<CreatePayPalOrderResult | null>(null)
  const buttonsContainerRef = React.useRef<HTMLDivElement>(null)

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

  // PayPal step 1: create the order server-side, then reveal the PayPal
  // Buttons for it (see the effect below) - PayPal Buttons render inline
  // into the page rather than opening a JS-triggered modal, so there's no
  // single "pay" click that does everything the way Razorpay's does.
  //
  // Razorpay is a single click end-to-end: create the order, open Checkout
  // as a modal, then verify the signature it hands back. The verify call is
  // what actually credits the wallet - the signature alone proves the
  // payment happened, nothing the browser sends is trusted on its own (see
  // backend/src/payments/payments.service.ts).
  async function onDeposit(values: DepositFormOutput) {
    setCreatingOrder(true)
    try {
      if (gateway === "paypal") {
        const order = await createPayPalOrder({ amountUsd: values.amount })
        setPendingOrder(order)
        return
      }

      const order = await createRazorpayOrder({
        amountUsd: values.amount,
        payCurrency: razorpayCurrency,
      })

      await loadRazorpayCheckout()
      const result = await openRazorpayCheckout({
        key: order.razorpayKeyId,
        order_id: order.razorpayOrderId,
        amount: order.amount,
        currency: order.currency,
        name: "Ad Network",
        description: "Wallet top-up",
      })

      await verifyRazorpayPayment({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      })

      toast.success(`Added ${formatCurrency(order.creditAmountUsd)} to your wallet`)
      form.reset({ amount: 50 })
      await load()
    } catch (error) {
      if (error instanceof Error && error.message === "DISMISSED") {
        // Buyer closed the Razorpay modal without paying - not an error.
        return
      }
      toast.error(
        error instanceof ApiError ? error.message : "Could not complete payment"
      )
    } finally {
      setCreatingOrder(false)
    }
  }

  function cancelPendingOrder() {
    setPendingOrder(null)
  }

  // Step 2: once an order exists, load the PayPal SDK (if not already) and
  // render its Buttons into the container below the form. `createOrder`
  // just hands back the order id we already created - PayPal never re-prices
  // anything client-side. `onApprove` calls our backend to capture the
  // payment; the backend talks to PayPal directly, so nothing the browser
  // sends here is trusted as proof of payment.
  React.useEffect(() => {
    if (!pendingOrder || !buttonsContainerRef.current) {
      return
    }

    let cancelled = false
    let instance: { close: () => Promise<void> } | undefined

    loadPayPalSdk(pendingOrder.paypalClientId)
      .then(() => {
        if (cancelled || !buttonsContainerRef.current) {
          return
        }
        instance = renderPayPalButtons(buttonsContainerRef.current, {
          createOrder: () => Promise.resolve(pendingOrder.paypalOrderId),
          onApprove: async (data) => {
            try {
              await capturePayPalPayment({ paypalOrderId: data.orderID })
              toast.success(
                `Added ${formatCurrency(pendingOrder.creditAmountUsd)} to your wallet`
              )
              setPendingOrder(null)
              form.reset({ amount: 50 })
              await load()
            } catch (error) {
              toast.error(
                error instanceof ApiError ? error.message : "Payment failed"
              )
            }
          },
          onCancel: () => {
            // Buyer closed the PayPal popup without paying - not an error,
            // just let them retry.
            setPendingOrder(null)
          },
          onError: (err) => {
            console.error(err)
            toast.error("PayPal Checkout failed to load")
            setPendingOrder(null)
          },
        })
      })
      .catch((error: Error) => {
        if (!cancelled) {
          toast.error(error.message)
          setPendingOrder(null)
        }
      })

    return () => {
      cancelled = true
      instance?.close().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrder])

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
          {pendingOrder ? (
            <>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pay {formatCurrency(pendingOrder.creditAmountUsd)} with
                  PayPal to complete your top-up. Indian PayPal accounts see
                  an INR estimate at checkout - the charge itself is in USD.
                </p>
                <div ref={buttonsContainerRef} />
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={cancelPendingOrder}>
                  Cancel
                </Button>
              </CardFooter>
            </>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onDeposit)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <FormLabel>Payment method</FormLabel>
                    <Select
                      value={gateway}
                      onValueChange={(value) => setGateway(value as Gateway)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="razorpay">Razorpay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {gateway === "razorpay" && (
                    <div className="space-y-2">
                      <FormLabel>Charge currency</FormLabel>
                      <Select
                        value={razorpayCurrency}
                        onValueChange={(value) =>
                          setRazorpayCurrency(value as RazorpayCurrency)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={creatingOrder}>
                    {creatingOrder
                      ? "Starting checkout..."
                      : gateway === "paypal"
                        ? "Continue to PayPal"
                        : "Pay with Razorpay"}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          )}
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
