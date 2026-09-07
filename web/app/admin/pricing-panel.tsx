"use client"

import * as React from "react"
import { toast } from "sonner"
import { Save } from "lucide-react"

import {
  adminGetAdFormatPricing,
  adminUpdateAdFormatPricing,
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
  }, [])

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
      <p className="text-sm text-muted-foreground">
        Set what advertisers are charged for each ad format, per pricing
        model. Changes appear in the campaign wizard&apos;s &quot;Ad
        format&quot; step within a few seconds.
      </p>

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
