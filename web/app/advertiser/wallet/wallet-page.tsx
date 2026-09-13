"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  CreditCard,
  Download,
  Landmark,
  PiggyBank,
  ShieldCheck,
  Wallet as WalletIcon,
  Zap,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
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
  CampaignStatus,
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
  amount: z.coerce.number().min(0.1, "Enter an amount of at least $0.1"),
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

const QUICK_AMOUNTS = [10, 25, 50, 100]

const CAMPAIGN_STATUS_BADGE: Record<
  CampaignStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  DRAFT: { variant: "outline" },
  PENDING_REVIEW: {
    variant: "outline",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  },
  ACTIVE: {
    variant: "outline",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  },
  PAUSED: { variant: "outline" },
  COMPLETED: { variant: "secondary" },
  ARCHIVED: { variant: "outline" },
}

// Client-side only - re-exports the already-loaded transactions as a CSV so
// advertisers can keep a local record, without adding a backend export
// endpoint. Amounts keep the DEPOSIT/REFUND sign convention shown on screen.
function downloadTransactionsCsv(transactions: WalletTransaction[]) {
  const header = ["Date", "Type", "Description", "Amount", "Status"]
  const rows = transactions.map((transaction) => {
    const isCredit = CREDIT_TYPES.includes(transaction.type)
    const amount = `${isCredit ? "+" : "-"}${transaction.amount}`
    return [
      new Date(transaction.createdAt).toISOString(),
      TRANSACTION_LABELS[transaction.type],
      transaction.description ?? "",
      amount,
      transaction.status,
    ]
  })
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `wallet-statement-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Client-side preview only, shown while the advertiser is still typing an
// amount - the real charge (and the GST line on it) is computed and
// persisted server-side in PaymentsService.computeGst, this just mirrors
// that 18% rate so the on-screen total doesn't visibly jump once an order
// is actually created.
const GST_PREVIEW_RATE = 0.18

export function AdvertiserWalletPage() {
  const { user } = useAuth()
  const isIndianAccount = user?.country?.toUpperCase() === "IN"
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

  const watchedAmount = Number(form.watch("amount")) || 0
  const gstPreview = isIndianAccount
    ? Math.round(watchedAmount * GST_PREVIEW_RATE * 100) / 100
    : 0
  const totalPreview = watchedAmount + gstPreview

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

      toast.success(
        order.gstAmountUsd
          ? `Added ${formatCurrency(order.creditAmountUsd)} to your wallet (charged ${formatCurrency(order.payAmount)} incl. ${formatCurrency(order.gstAmountUsd)} GST)`
          : `Added ${formatCurrency(order.creditAmountUsd)} to your wallet`
      )
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
                pendingOrder.gstAmountUsd
                  ? `Added ${formatCurrency(pendingOrder.creditAmountUsd)} to your wallet (charged ${formatCurrency(pendingOrder.payAmount)} incl. GST)`
                  : `Added ${formatCurrency(pendingOrder.creditAmountUsd)} to your wallet`
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

  const currentBalanceNum = Number(summary?.currentBalance ?? 0)
  const availableNum = Number(summary?.availableBalance ?? 0)
  const reservedNum = Number(summary?.reservedBalance ?? 0)
  const balanceDenominator = currentBalanceNum > 0 ? currentBalanceNum : 1
  const availablePct = Math.max(
    0,
    Math.min(100, (availableNum / balanceDenominator) * 100)
  )
  const reservedPct = Math.max(
    0,
    Math.min(100 - availablePct, (reservedNum / balanceDenominator) * 100)
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex size-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-orange-500/20">
            <WalletIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
            <p className="text-muted-foreground">
              Manage your advertiser balance, top-ups, and campaign spending.
            </p>
          </div>
        </div>
      </div>

      {loading && !summary ? (
        <Skeleton className="h-36 w-full" />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-6 pt-6 sm:grid-cols-4 sm:divide-x sm:divide-border">
            <BalanceStat
              label="Current balance"
              value={summary?.currentBalance}
              icon={WalletIcon}
              iconClassName="brand-gradient"
            />
            <BalanceStat
              label="Available"
              value={summary?.availableBalance}
              icon={PiggyBank}
              iconClassName="bg-gradient-to-br from-emerald-500 to-teal-500"
              padded
            />
            <BalanceStat
              label="Reserved for campaigns"
              value={summary?.reservedBalance}
              icon={ShieldCheck}
              iconClassName="bg-gradient-to-br from-amber-500 to-orange-500"
              padded
            />
            <BalanceStat
              label="Total spent"
              value={summary?.totalSpent}
              icon={Landmark}
              iconClassName="bg-gradient-to-br from-slate-500 to-slate-700"
              padded
            />
          </CardContent>
          <div className="space-y-2 border-t bg-muted/20 px-6 py-4">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                style={{ width: `${availablePct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                style={{ width: `${reservedPct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Available to spend
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                Reserved for active campaigns
              </span>
            </div>
          </div>
        </Card>
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
                {pendingOrder.gstAmountUsd ? (
                  <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Top-up amount</span>
                      <span className="tabular-nums">
                        {formatCurrency(pendingOrder.creditAmountUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST (18%)</span>
                      <span className="tabular-nums">
                        {formatCurrency(pendingOrder.gstAmountUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-medium">
                      <span>Total charged</span>
                      <span className="tabular-nums">
                        {formatCurrency(pendingOrder.payAmount)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Pay {formatCurrency(pendingOrder.payAmount)} with PayPal
                    to complete your top-up. Non-US accounts see a
                    local-currency estimate at checkout - the charge itself
                    is in USD.
                  </p>
                )}
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
                    <div
                      role="radiogroup"
                      aria-label="Payment method"
                      className="grid grid-cols-2 gap-2"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={gateway === "paypal"}
                        onClick={() => setGateway("paypal")}
                        className={
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors " +
                          (gateway === "paypal"
                            ? "border-[#0070ba] bg-[#0070ba]/5 ring-1 ring-[#0070ba]"
                            : "border-border hover:bg-muted/50")
                        }
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0070ba] text-white">
                          <CreditCard className="size-3.5" />
                        </span>
                        PayPal
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={gateway === "razorpay"}
                        onClick={() => setGateway("razorpay")}
                        className={
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors " +
                          (gateway === "razorpay"
                            ? "border-[#3395ff] bg-[#3395ff]/5 ring-1 ring-[#3395ff]"
                            : "border-border hover:bg-muted/50")
                        }
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#3395ff] text-white">
                          <Zap className="size-3.5" />
                        </span>
                        Razorpay
                      </button>
                    </div>
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
                  <div className="space-y-2">
                    <FormLabel>Amount (USD)</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_AMOUNTS.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() =>
                            form.setValue("amount", amount, {
                              shouldValidate: true,
                            })
                          }
                          className={
                            "rounded-full border px-3 py-1 text-sm font-medium transition-colors " +
                            (watchedAmount === amount
                              ? "border-transparent bg-foreground text-background"
                              : "border-border hover:bg-muted/50")
                          }
                        >
                          ${amount}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.1"
                            placeholder="Custom amount"
                            {...field}
                            value={(field.value as number | string) ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isIndianAccount && watchedAmount > 0 ? (
                    <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="tabular-nums">
                          {formatCurrency(watchedAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST (18%) - India</span>
                        <span className="tabular-nums">
                          {formatCurrency(gstPreview)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1.5 font-medium">
                        <span>You&apos;ll be charged</span>
                        <span className="tabular-nums">
                          {formatCurrency(totalPreview)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your wallet is still credited the full{" "}
                        {formatCurrency(watchedAmount)} - GST is an extra cost
                        on top, required for Indian accounts.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={creatingOrder} className="w-full">
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
                  summary.campaignSpending.map((campaign) => {
                    const statusBadge = CAMPAIGN_STATUS_BADGE[campaign.status]
                    return (
                      <TableRow
                        key={campaign.campaignId}
                        className="hover:bg-muted/40"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{campaign.campaignName}</span>
                            <Badge
                              variant={statusBadge.variant}
                              className={statusBadge.className}
                            >
                              {campaign.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(campaign.totalBudget)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(campaign.reserved)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(campaign.spent)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(campaign.remaining)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <p className="text-sm text-muted-foreground">
                        No campaigns yet - launch one to see spending here.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Transaction history</CardTitle>
            <CardDescription>Every ledgered event on your wallet.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!transactions.length}
            onClick={() => downloadTransactionsCsv(transactions)}
          >
            <Download className="size-4" />
            Download statement
          </Button>
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
                    <TableRow key={transaction.id} className="hover:bg-muted/40">
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
                          "text-right font-medium tabular-nums " +
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
                  <TableCell colSpan={5} className="h-24 text-center">
                    <p className="text-sm text-muted-foreground">
                      No transactions yet - they&apos;ll show up here once you
                      add funds or run campaigns.
                    </p>
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

function BalanceStat({
  label,
  value,
  icon: Icon,
  iconClassName,
  padded = false,
}: {
  label: string
  value?: string
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
  padded?: boolean
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 ${padded ? "sm:pl-6" : ""}`}
    >
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {value !== undefined ? formatCurrency(value) : "-"}
        </p>
      </div>
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-white ${iconClassName}`}
      >
        <Icon className="size-4" />
      </div>
    </div>
  )
}
