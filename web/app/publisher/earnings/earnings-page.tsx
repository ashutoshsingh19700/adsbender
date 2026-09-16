"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  ApiError,
  getBeneficiaryAccount,
  getWalletSummary,
  listPayouts,
  listWalletTransactions,
  requestPayout,
  setBeneficiaryAccount,
} from "@/lib/api"
import type {
  BeneficiaryAccount,
  BeneficiaryAccountType,
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

const beneficiarySchema = z
  .object({
    accountType: z.enum(["BANK_ACCOUNT", "VPA"]),
    accountHolderName: z.string().min(1, "Enter the account holder's name"),
    bankAccountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    vpa: z.string().optional(),
  })
  .refine(
    (values) =>
      values.accountType === "VPA" || !!values.bankAccountNumber?.trim(),
    { message: "Enter the bank account number", path: ["bankAccountNumber"] }
  )
  .refine(
    (values) => values.accountType === "VPA" || !!values.ifscCode?.trim(),
    { message: "Enter the IFSC code", path: ["ifscCode"] }
  )
  .refine(
    (values) => values.accountType === "BANK_ACCOUNT" || !!values.vpa?.trim(),
    { message: "Enter a UPI ID", path: ["vpa"] }
  )

type BeneficiaryFormInput = z.input<typeof beneficiarySchema>
type BeneficiaryFormOutput = z.output<typeof beneficiarySchema>

export function PublisherEarningsPage() {
  const [summary, setSummary] = React.useState<PublisherWalletSummary | null>(
    null
  )
  const [transactions, setTransactions] = React.useState<WalletTransaction[]>(
    []
  )
  const [payouts, setPayouts] = React.useState<Payout[]>([])
  const [beneficiary, setBeneficiary] = React.useState<BeneficiaryAccount | null>(
    null
  )
  const [loading, setLoading] = React.useState(true)
  const [savingBeneficiary, setSavingBeneficiary] = React.useState(false)

  const payoutForm = useForm<
    PayoutRequestFormInput,
    unknown,
    PayoutRequestFormOutput
  >({
    resolver: zodResolver(payoutRequestSchema),
    defaultValues: { amount: 20 },
  })

  const beneficiaryForm = useForm<
    BeneficiaryFormInput,
    unknown,
    BeneficiaryFormOutput
  >({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: { accountType: "BANK_ACCOUNT", accountHolderName: "" },
  })
  const beneficiaryAccountType = beneficiaryForm.watch("accountType")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [summaryResult, transactionsResult, payoutsResult, beneficiaryResult] =
        await Promise.all([
          getWalletSummary() as Promise<PublisherWalletSummary>,
          listWalletTransactions({ pageSize: 20 }),
          listPayouts({ pageSize: 20 }),
          getBeneficiaryAccount(),
        ])
      setSummary(summaryResult)
      setTransactions(transactionsResult.transactions)
      setPayouts(payoutsResult.payouts)
      setBeneficiary(beneficiaryResult)
      if (beneficiaryResult) {
        beneficiaryForm.reset({
          accountType: beneficiaryResult.accountType,
          accountHolderName: beneficiaryResult.accountHolderName,
          bankAccountNumber: beneficiaryResult.bankAccountNumber ?? "",
          ifscCode: beneficiaryResult.ifscCode ?? "",
          vpa: beneficiaryResult.vpa ?? "",
        })
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load earnings"
      )
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSaveBeneficiary(values: BeneficiaryFormOutput) {
    setSavingBeneficiary(true)
    try {
      const saved = await setBeneficiaryAccount({
        accountType: values.accountType as BeneficiaryAccountType,
        accountHolderName: values.accountHolderName,
        bankAccountNumber: values.bankAccountNumber,
        ifscCode: values.ifscCode,
        vpa: values.vpa,
      })
      setBeneficiary(saved)
      toast.success("Payout account saved")
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save payout account"
      )
    } finally {
      setSavingBeneficiary(false)
    }
  }

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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Earnings</h1>
        <p className="font-medium text-foreground/75">
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
        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Payout account</CardTitle>
            <CardDescription>
              Where payouts are sent. Required before a payout can be paid
              out automatically - without one, requests are held for manual
              processing.
            </CardDescription>
          </CardHeader>
          <Form {...beneficiaryForm}>
            <form onSubmit={beneficiaryForm.handleSubmit(onSaveBeneficiary)}>
              <CardContent className="space-y-4">
                <FormField
                  control={beneficiaryForm.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payout method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="BANK_ACCOUNT">
                            Bank account
                          </SelectItem>
                          <SelectItem value="VPA">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={beneficiaryForm.control}
                  name="accountHolderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account holder name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {beneficiaryAccountType === "VPA" ? (
                  <FormField
                    control={beneficiaryForm.control}
                    name="vpa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UPI ID</FormLabel>
                        <FormControl>
                          <Input placeholder="name@bank" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <>
                    <FormField
                      control={beneficiaryForm.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={beneficiaryForm.control}
                      name="ifscCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={savingBeneficiary}>
                  {savingBeneficiary
                    ? "Saving..."
                    : beneficiary
                      ? "Update payout account"
                      : "Save payout account"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request payout</CardTitle>
            <CardDescription>
              Minimum payout is{" "}
              {summary
                ? formatCurrency(summary.minimumPayoutThreshold)
                : "…"}
              . {beneficiary
                ? "Paid out to the account above once processed."
                : "No payout account on file yet, so requests are queued for manual processing."}
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
        </div>

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
                      <TableCell className="whitespace-nowrap text-sm font-medium text-foreground/75">
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
                      className="text-center text-sm font-medium text-foreground/75"
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
                      <TableCell className="whitespace-nowrap text-sm font-medium text-foreground/75">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {TRANSACTION_LABELS[transaction.type]}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground/75">
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
                    className="text-center text-sm font-medium text-foreground/75"
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
        <p className="text-sm font-medium text-foreground/75">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {value !== undefined ? formatCurrency(value) : "-"}
        </p>
      </CardContent>
    </Card>
  )
}
