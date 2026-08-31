"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { ApiError, validateDomain } from "@/lib/api"
import type { PublisherSite } from "@/lib/types"
import {
  AD_UNIT_FORMAT_OPTIONS,
  WEBSITE_CATEGORIES,
  setSiteMeta,
} from "@/app/publisher/websites/site-meta"

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
  adultAds: z.boolean(),
  adUnitFormats: z.array(z.string()),
})

type AddWebsiteValues = z.infer<typeof addWebsiteSchema>

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
        adultAds: values.adultAds,
      })
      // Ad unit formats still have no backend column (see site-meta.ts) -
      // category/adultAds are now real fields on the site itself.
      setSiteMeta(site.domain, { adUnitFormats: values.adUnitFormats })
      toast.success(`${site.domain} added`)
      onCreated(site)
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not add website"
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new Website</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="example.com" {...field} />
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
                  <FormLabel>Website category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
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
                    <p className="text-xs text-muted-foreground">
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

            <DialogFooter>
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
