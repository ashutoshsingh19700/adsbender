"use client"

import * as React from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Lock,
  MoreVertical,
  PiggyBank,
  ShieldCheck,
  Sparkles,
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

const CAMPAIGN_STATUS_STYLE: Record<
  CampaignStatus,
  { dot: string; badge: string }
> = {
  DRAFT: { dot: "bg-slate-400", badge: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  PENDING_REVIEW: { dot: "bg-slate-400", badge: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  ACTIVE: { dot: "bg-emerald-500", badge: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  PAUSED: { dot: "bg-amber-500", badge: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  COMPLETED: { dot: "bg-sky-500", badge: "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400" },
  ARCHIVED: { dot: "bg-slate-400", badge: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
}

// Derived from the deposit description written server-side
// (`${providerLabel} top-up (...)`, see PaymentsService.creditWallet) -
// there's no dedicated "gateway" column on WalletTransaction, so this is
// the only place that information survives to the ledger.
function paymentMethodFor(transaction: WalletTransaction) {
  if (transaction.type !== "DEPOSIT") return "—"
  const description = transaction.description ?? ""
  if (description.startsWith("PayPal")) return "PayPal"
  if (description.startsWith("Razorpay")) return "Razorpay"
  return "—"
}

// Client-side only - re-exports the already-loaded transactions as a CSV so
// advertisers can keep a local record, without adding a backend export
// endpoint. Amounts keep the DEPOSIT/REFUND sign convention shown on screen.
function downloadTransactionsCsv(transactions: WalletTransaction[]) {
  const header = [
    "Date",
    "Description",
    "Payment Method",
    "Amount",
    "Status",
    "Transaction ID",
  ]
  const rows = transactions.map((transaction) => {
    const isCredit = CREDIT_TYPES.includes(transaction.type)
    const amount = `${isCredit ? "+" : "-"}${transaction.amount}`
    return [
      new Date(transaction.createdAt).toISOString(),
      transaction.description ?? TRANSACTION_LABELS[transaction.type],
      paymentMethodFor(transaction),
      amount,
      transaction.status,
      transaction.referenceId ?? transaction.id,
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
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

        {/* Purely decorative promo panel - matches the reference dashboard's
            wallet header, no data or action attached. */}
        <div className="relative hidden flex-1 items-center gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-50 via-fuchsia-50 to-orange-50 px-5 py-4 dark:from-violet-950/40 dark:via-fuchsia-950/30 dark:to-orange-950/30 lg:flex">
          <Sparkles className="size-5 shrink-0 text-fuchsia-500" />
          <div className="min-w-0">
            <p className="truncate font-medium">
              Power your campaigns with a seamless wallet
            </p>
            <p className="truncate text-sm text-muted-foreground">
              Add funds and reach more people.
            </p>
          </div>
          <CreditCard className="ml-auto hidden size-10 shrink-0 -rotate-6 text-violet-300 dark:text-violet-700 xl:block" />
        </div>
      </div>

      {loading && !summary ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-4">
          <BalanceCard
            label="Current balance"
            value={summary?.currentBalance}
            icon={WalletIcon}
            tint="bg-violet-50 dark:bg-violet-950/30"
            iconClassName="bg-gradient-to-br from-violet-600 to-indigo-500"
            ringClassName="bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300"
          />
          <BalanceCard
            label="Available"
            value={summary?.availableBalance}
            icon={PiggyBank}
            tint="bg-emerald-50 dark:bg-emerald-950/30"
            iconClassName="bg-gradient-to-br from-emerald-500 to-teal-500"
            ringClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300"
          />
          <BalanceCard
            label="Reserved for campaigns"
            value={summary?.reservedBalance}
            icon={ShieldCheck}
            tint="bg-amber-50 dark:bg-amber-950/30"
            iconClassName="bg-gradient-to-br from-amber-500 to-orange-500"
            ringClassName="bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300"
          />
          <BalanceCard
            label="Total spent"
            value={summary?.totalSpent}
            icon={Landmark}
            tint="bg-sky-50 dark:bg-sky-950/30"
            iconClassName="bg-gradient-to-br from-sky-500 to-blue-500"
            ringClassName="bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-300"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
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
                      <PaymentMethodTile
                        label="PayPal"
                        icon={CreditCard}
                        iconClassName="bg-[#0070ba]"
                        selected={gateway === "paypal"}
                        onSelect={() => setGateway("paypal")}
                      />
                      <PaymentMethodTile
                        label="Razorpay"
                        icon={Zap}
                        iconClassName="bg-[#3395ff]"
                        selected={gateway === "razorpay"}
                        onSelect={() => setGateway("razorpay")}
                      />
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
                    <div className="grid grid-cols-4 gap-2">
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
                            "rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors " +
                            (watchedAmount === amount
                              ? "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
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
                          <div className="flex items-stretch overflow-hidden rounded-lg border focus-within:ring-2 focus-within:ring-ring/50">
                            <span className="flex items-center bg-muted/50 px-3 text-sm font-medium text-muted-foreground">
                              $
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.1"
                              className="rounded-none border-0 focus-visible:ring-0"
                              {...field}
                              value={(field.value as number | string) ?? ""}
                            />
                          </div>
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
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={creatingOrder}
                    className="w-full"
                  >
                    {creatingOrder
                      ? "Starting checkout..."
                      : gateway === "paypal"
                        ? "Continue to PayPal"
                        : "Pay with Razorpay"}
                    {!creatingOrder && <ArrowRight className="size-4" />}
                  </Button>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3" />
                    Secure payment powered by{" "}
                    {gateway === "paypal" ? "PayPal" : "Razorpay"}
                  </p>
                </CardFooter>
              </form>
            </Form>
          )}
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-fuchsia-500 text-white">
                <BarChart3 className="size-4" />
              </div>
              <div>
                <CardTitle>Campaign spending</CardTitle>
                <CardDescription>
                  Budget reserved and spent per campaign.
                </CardDescription>
              </div>
            </div>
            {/* Static range label - the summary endpoint isn't date-filtered
                yet, so this isn't wired to a real filter. */}
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
              <Calendar className="size-3.5" />
              Last 30 days
              <ChevronDown className="size-3.5" />
            </span>
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
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.campaignSpending.length ? (
                  summary.campaignSpending.map((campaign) => {
                    const style = CAMPAIGN_STATUS_STYLE[campaign.status]
                    return (
                      <TableRow
                        key={campaign.campaignId}
                        className="hover:bg-muted/40"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`size-1.5 shrink-0 rounded-full ${style.dot}`} />
                            <span>{campaign.campaignName}</span>
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
                        <TableCell className="text-right">
                          <Badge className={style.badge}>
                            {campaign.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <RowMenu />
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <p className="text-sm text-muted-foreground">
                        No campaigns yet - launch one to see spending here.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {summary?.campaignSpending.length ? (
              <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                <span>Showing {summary.campaignSpending.length} campaigns</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled
                    className="flex size-7 items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronRight className="size-3.5 rotate-180" />
                  </button>
                  <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
                    1
                  </span>
                  <button
                    type="button"
                    disabled
                    className="flex size-7 items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
              <FileText className="size-4" />
            </div>
            <div>
              <CardTitle>Transaction history</CardTitle>
              <CardDescription>Every ledgered event on your wallet.</CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!transactions.length}
            onClick={() => downloadTransactionsCsv(transactions)}
          >
            <Download className="size-4" />
            Download Statement
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transaction ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length ? (
                transactions.map((transaction) => {
                  const isCredit = CREDIT_TYPES.includes(transaction.type)
                  const reference = transaction.referenceId ?? transaction.id
                  return (
                    <TableRow key={transaction.id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          {transaction.description ??
                            TRANSACTION_LABELS[transaction.type]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {TRANSACTION_LABELS[transaction.type]}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {paymentMethodFor(transaction)}
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
                      <TableCell
                        className="max-w-32 truncate font-mono text-xs text-muted-foreground"
                        title={reference}
                      >
                        {reference}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <FileText className="size-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">No transactions yet</p>
                      <p className="text-sm text-muted-foreground">
                        Your wallet activity will appear here once you add
                        funds or run campaigns.
                      </p>
                    </div>
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

function BalanceCard({
  label,
  value,
  icon: Icon,
  tint,
  iconClassName,
  ringClassName,
}: {
  label: string
  value?: string
  icon: React.ComponentType<{ className?: string }>
  tint: string
  iconClassName: string
  ringClassName: string
}) {
  return (
    <Card className={`overflow-hidden border-transparent ${tint}`}>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-white ${iconClassName}`}
          >
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {value !== undefined ? formatCurrency(value) : "-"}
            </p>
          </div>
        </div>
        {/* Decorative - no per-tile drill-down page exists yet. */}
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${ringClassName}`}
        >
          <ChevronRight className="size-3.5" />
        </span>
      </CardContent>
    </Card>
  )
}

function PaymentMethodTile({
  label,
  icon: Icon,
  iconClassName,
  selected,
  onSelect,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        "relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors " +
        (selected
          ? "border-violet-400 bg-violet-50/60 ring-1 ring-violet-400 dark:bg-violet-950/30"
          : "border-border hover:bg-muted/50")
      }
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-white ${iconClassName}`}
      >
        <Icon className="size-3.5" />
      </span>
      {label}
      {selected ? (
        <CheckCircle2 className="absolute right-2 top-2 size-4 text-violet-500" />
      ) : (
        <span className="absolute right-2.5 top-2.5 size-3.5 rounded-full border border-border" />
      )}
    </button>
  )
}

// Minimal per-row actions menu built on <details>/<summary> so it needs no
// extra dependency - there's no per-campaign detail route yet, so its only
// item links back to the campaigns list rather than faking a destination.
function RowMenu() {
  return (
    <details className="group relative">
      <summary
        className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted [&::-webkit-details-marker]:hidden"
        aria-label="Campaign actions"
      >
        <MoreVertical className="size-4 text-muted-foreground" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        <Link
          href="/advertiser/campaigns"
          className="block rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
        >
          View in My Campaigns
        </Link>
      </div>
    </details>
  )
}
