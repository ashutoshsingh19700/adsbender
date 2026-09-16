"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { ApiError, createAdZone, validateDomain } from "@/lib/api"
import type { PublisherSite } from "@/lib/types"
import {
  AD_UNIT_FORMAT_OPTIONS,
  WEBSITE_CATEGORIES,
} from "@/app/publisher/websites/site-meta"
import { COUNTRIES, countryFlag } from "@/app/advertiser/campaign-fields"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Switch } from "@/components/ui/switch"

const addWebsiteSchema = z.object({
  domain: z.string().min(3, "Enter a website address, e.g. example.com"),
  category: z.string().optional(),
  country: z.string().optional(),
  adultAds: z.boolean(),
  adUnitFormats: z.array(z.string()),
})

type AddWebsiteValues = z.infer<typeof addWebsiteSchema>

const DOMAIN_VALIDATION_MESSAGES: Record<string, string> = {
  DOMAIN_UNREACHABLE:
    "We couldn't reach that website. Check the address and make sure the site is online.",
  ADS_TXT_NOT_FOUND:
    "We couldn't find an ads.txt file on that website. Add one at yoursite.com/ads.txt and try again.",
  ADS_TXT_VERIFICATION_TEXT_MISSING:
    "Your ads.txt file doesn't have the verification line yet. Add it, then try again.",
}

function describeValidationError(error: unknown): string {
  if (error instanceof ApiError) {
    return DOMAIN_VALIDATION_MESSAGES[error.message] ?? error.message
  }
  return "Could not add website"
}

export function AddWebsiteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (site: PublisherSite) => void
}) {
  const form = useForm<AddWebsiteValues>({
    resolver: zodResolver(addWebsiteSchema),
    defaultValues: {
      domain: "",
      category: undefined,
      country: undefined,
      adultAds: false,
      adUnitFormats: [],
    },
  })

  React.useEffect(() => {
    if (open) form.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: AddWebsiteValues) {
    try {
      const site = await validateDomain({
        domain: values.domain,
        category: values.category,
        country: values.country,
        adultAds: values.adultAds,
      })

      // Each checked format becomes a real ad zone tied to this site, so it
      // shows up nested under the site on the Websites page instead of just
      // living as a client-side label (see site-meta.ts's old
      // adUnitFormats-only approach). One zone failing to create shouldn't
      // roll back the site itself - it's already been added successfully.
      const failures: string[] = []
      await Promise.all(
        values.adUnitFormats.map(async (formatValue) => {
          const format = AD_UNIT_FORMAT_OPTIONS.find(
            (option) => option.value === formatValue
          )
          if (!format) return
          try {
            await createAdZone({
              zoneName: `${site.domain} - ${format.label}`,
              width: format.width,
              height: format.height,
              layoutType: format.value,
              siteId: site.id,
            })
          } catch {
            failures.push(format.label)
          }
        })
      )

      if (failures.length > 0) {
        toast.error(`${site.domain} added, but couldn't create: ${failures.join(", ")}`)
      } else {
        toast.success(`${site.domain} added`)
      }
      onCreated(site)
      onOpenChange(false)
    } catch (error) {
      toast.error(describeValidationError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add new Website</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Website</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Website"
                      className="h-11 rounded-lg px-3.5 text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Website category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 w-full rounded-lg px-3.5 text-sm">
                        <SelectValue placeholder="Website category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WEBSITE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">
                    Primary traffic country
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 w-full rounded-lg px-3.5 text-sm">
                        <SelectValue placeholder="Primary traffic country (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {countryFlag(country.value)} {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs font-medium text-foreground/75">
                    Helps advertisers only target countries this site actually
                    reaches.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adultAds"
              render={({ field }) => (
                <FormItem className="space-y-0 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <FormLabel className="text-sm font-medium">
                      Show adult ads
                    </FormLabel>
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    >
                      Boost your CPM
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-1.5">
                    <p className="text-xs font-medium text-foreground/75">
                      Adult ads typically help to increase CPM and revenue.
                    </p>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adUnitFormats"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Choose Ad Unit format</FormLabel>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {AD_UNIT_FORMAT_OPTIONS.map((option) => {
                      const checked = field.value.includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className="group flex items-center gap-2"
                        >
                          <FormControl>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                field.onChange(
                                  next
                                    ? [...field.value, option.value]
                                    : field.value.filter(
                                        (v) => v !== option.value
                                      )
                                )
                              }}
                            />
                          </FormControl>
                          <span className="flex items-center gap-1.5 text-sm font-normal">
                            {option.label}
                            {option.top ? (
                              <Badge
                                variant="secondary"
                                className="h-4 bg-emerald-100 px-1.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                              >
                                Top
                              </Badge>
                            ) : null}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
