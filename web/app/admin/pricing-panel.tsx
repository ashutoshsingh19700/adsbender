"use client"

import * as React from "react"
import { toast } from "sonner"
import { Save } from "lucide-react"

import {
  adminGetAdFormatPricing,
  adminGetMinAdvertiserBalance,
  adminGetPlatformFee,
  adminUpdateAdFormatPricing,
  adminUpdateMinAdvertiserBalance,
  adminUpdatePlatformFee,
  ApiError,
  type AdFormatRate,
} from "@/lib/api"
import { AD_FORMAT_CATALOG } from "@/lib/ad-formats"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

// The 3 legacy formats that predate AD_FORMAT_CATALOG (see LEGACY_AD_FORMATS
// in advertiser/campaign-fields.ts) - every other format's label comes
// straight off the shared catalog.
const LEGACY_FORMAT_LABELS: { value: string; label: string }[] = [
  { value: "SOCIAL_BAR", label: "Social Bar" },
  { value: "NATIVE_BANNER", label: "Native Banner" },
  { value: "IN_PAGE_PUSH", label: "In-Page Push" },
]

const ALL_FORMATS = [
  ...LEGACY_FORMAT_LABELS,
  ...AD_FORMAT_CATALOG.map((f) => ({ value: f.value, label: f.label })),
]

type Row = AdFormatRate & { value: string; label: string }

// Lets an admin edit what advertisers are charged per ad format, per
// pricing model (CPM/CPA/CPC) - shown live in the campaign wizard's "Ad
// format" step. Each row saves independently (adminUpdateAdFormatPricing
// replaces just that one format's override, see
// PlatformSettingsService.updateAdFormatPricing) so editing one row can
// never clobber another admin's concurrent edit to a different row.
export function PricingPanel() {
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<Record<string, boolean>>({})

  const [minBalance, setMinBalance] = React.useState("")
  const [minBalanceLoading, setMinBalanceLoading] = React.useState(true)
  const [minBalanceSaving, setMinBalanceSaving] = React.useState(false)

  // Shown/edited as a percent (e.g. "20") for admin friendliness - the API
  // itself is basis points (platformFeeBps: 2000 = 20.00%), converted at
  // the edges below. See MoneyFlowPanel, which reads and displays the same
  // setting read-only and points here to change it.
  const [platformFeePercent, setPlatformFeePercent] = React.useState("")
  const [platformFeeLoading, setPlatformFeeLoading] = React.useState(true)
  const [platformFeeSaving, setPlatformFeeSaving] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    ;(async () => {
      setLoading(true)
      try {
        const pricing = await adminGetAdFormatPricing()
        setRows(
          ALL_FORMATS.map(({ value, label }) => ({
            value,
            label,
            cpm: pricing[value]?.cpm ?? 0,
            cpa: pricing[value]?.cpa ?? 0,
            cpc: pricing[value]?.cpc ?? 0,
          }))
        )
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not load ad format pricing"
        )
      } finally {
        setLoading(false)
      }
    })()

    // eslint-disable-next-line react-hooks/set-state-in-effect
    ;(async () => {
      setMinBalanceLoading(true)
      try {
        const { minAdvertiserBalanceUsd } = await adminGetMinAdvertiserBalance()
        setMinBalance(minAdvertiserBalanceUsd)
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not load the minimum advertiser balance"
        )
      } finally {
        setMinBalanceLoading(false)
      }
    })()

    // eslint-disable-next-line react-hooks/set-state-in-effect
    ;(async () => {
      setPlatformFeeLoading(true)
      try {
        const { platformFeePercent } = await adminGetPlatformFee()
        setPlatformFeePercent(String(platformFeePercent))
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not load the platform fee"
        )
      } finally {
        setPlatformFeeLoading(false)
      }
    })()
  }, [])

  async function handleSaveMinBalance() {
    const parsed = Number(minBalance)
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Enter a valid, non-negative amount")
      return
    }

    setMinBalanceSaving(true)
    try {
      const { minAdvertiserBalanceUsd } =
        await adminUpdateMinAdvertiserBalance(parsed)
      setMinBalance(minAdvertiserBalanceUsd)
      toast.success("Minimum advertiser balance updated")
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save"
      )
    } finally {
      setMinBalanceSaving(false)
    }
  }

  async function handleSavePlatformFee() {
    const percent = Number(platformFeePercent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error("Enter a valid percentage between 0 and 100")
      return
    }

    setPlatformFeeSaving(true)
    try {
      const { platformFeePercent: saved } = await adminUpdatePlatformFee(
        Math.round(percent * 100)
      )
      setPlatformFeePercent(String(saved))
      toast.success("Platform fee updated")
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save"
      )
    } finally {
      setPlatformFeeSaving(false)
    }
  }

  const updateField = (
    value: string,
    field: "cpm" | "cpa" | "cpc",
    raw: string
  ) => {
    const parsed = Number(raw)
    setRows((prev) =>
      prev.map((row) =>
        row.value === value
          ? { ...row, [field]: Number.isFinite(parsed) ? parsed : 0 }
          : row
      )
    )
  }

  const handleSave = async (row: Row) => {
    setSaving((prev) => ({ ...prev, [row.value]: true }))
    try {
      await adminUpdateAdFormatPricing(row.value, {
        cpm: row.cpm,
        cpa: row.cpa,
        cpc: row.cpc,
      })
      toast.success(`${row.label} rates updated`)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save rates"
      )
    } finally {
      setSaving((prev) => ({ ...prev, [row.value]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground/75">
        Set what advertisers are charged for each ad format, per pricing
        model. Changes appear in the campaign wizard&apos;s &quot;Ad
        format&quot; step within a few seconds.
      </p>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div>
            <p className="text-sm font-medium">Platform fee</p>
            <p className="text-sm font-medium text-foreground/75">
              Cut kept from every dollar of ad spend before crediting the
              publisher (see Money Flow for a worked example). Defaults to
              20%.
            </p>
          </div>
          {platformFeeLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="w-32"
                value={platformFeePercent}
                onChange={(e) => setPlatformFeePercent(e.target.value)}
              />
              <span className="text-sm font-medium text-foreground/75">%</span>
              <Button
                size="sm"
                onClick={handleSavePlatformFee}
                disabled={platformFeeSaving}
              >
                <Save className="size-4" />
                {platformFeeSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div>
            <p className="text-sm font-medium">Minimum advertiser balance</p>
            <p className="text-sm font-medium text-foreground/75">
              An advertiser must keep at least this much free (unreserved)
              in their wallet, on top of any campaign budget, to submit or
              have a campaign approved. This money is never itself spendable
              or reservable by a campaign. Defaults to $10.
            </p>
          </div>
          {minBalanceLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground/75">$</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-32"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleSaveMinBalance}
                disabled={minBalanceSaving}
              >
                <Save className="size-4" />
                {minBalanceSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad format</TableHead>
                    <TableHead>CPM ($)</TableHead>
                    <TableHead>CPA ($)</TableHead>
                    <TableHead>CPC ($)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.value}>
                      <TableCell className="font-medium">
                        {row.label}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-24"
                          value={row.cpm}
                          onChange={(e) =>
                            updateField(row.value, "cpm", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-24"
                          value={row.cpa}
                          onChange={(e) =>
                            updateField(row.value, "cpa", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-24"
                          value={row.cpc}
                          onChange={(e) =>
                            updateField(row.value, "cpc", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(row)}
                          disabled={saving[row.value]}
                        >
                          <Save className="size-4" />
                          {saving[row.value] ? "Saving..." : "Save"}
                        </Button>
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
