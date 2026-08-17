"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ApiError, createCampaign } from "@/lib/api"
import type { Campaign } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  COUNTRIES,
  DEVICES,
  campaignSchema,
  type CampaignFormInput,
  type CampaignFormOutput,
} from "@/app/advertiser/campaign-fields"

const STEPS = ["Budget", "Targeting", "Creative"] as const
const STEP_FIELDS: Record<number, (keyof CampaignFormInput)[]> = {
  0: ["campaignName", "totalBudget", "dailyBudget", "maxCpc"],
  1: ["targetCountries", "targetDevices"],
  2: ["creativeType", "creativeUrl", "creativeHtml"],
}

export function CampaignWizard({
  onCreated,
}: {
  onCreated?: (campaign: Campaign) => void
} = {}) {
  const [step, setStep] = React.useState(0)
  const [result, setResult] = React.useState<Campaign | null>(null)

  const form = useForm<CampaignFormInput, unknown, CampaignFormOutput>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaignName: "",
      totalBudget: 100,
      dailyBudget: 20,
      maxCpc: 0.5,
      targetCountries: [],
      targetDevices: [],
      creativeType: "image",
      creativeUrl: "",
      creativeHtml: "",
      notes: "",
    },
  })

  const creativeType = form.watch("creativeType")

  async function goNext() {
    const valid = await form.trigger(STEP_FIELDS[step])
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function onSubmit(values: CampaignFormOutput) {
    try {
      const { campaign } = await createCampaign(values)
      setResult(campaign)
      onCreated?.(campaign)
      toast.success(`${campaign.campaignName} submitted as ${campaign.status}`)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not submit campaign"
      )
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign submitted</CardTitle>
            <CardDescription>
              Your campaign is now awaiting review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{result.campaignName}</span>
              <Badge>{result.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Total budget ${result.totalBudget} · Daily budget $
              {result.dailyBudget} · Max CPC ${result.maxCpc}
            </p>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null)
                form.reset()
                setStep(0)
              }}
            >
              Create another campaign
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Create a new campaign
        </h2>
        <p className="text-sm text-muted-foreground">
          Submit a new campaign in three steps.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <Tabs value={STEPS[step]}>
                <TabsList className="grid w-full grid-cols-3">
                  {STEPS.map((label, index) => (
                    <TabsTrigger
                      key={label}
                      value={label}
                      disabled={index > step}
                      onClick={() => index < step && setStep(index)}
                    >
                      {index + 1}. {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="space-y-4">
              {step === 0 ? (
                <>
                  <FormField
                    control={form.control}
                    name="campaignName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign name</FormLabel>
                        <FormControl>
                          <Input placeholder="Summer sale 2026" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="totalBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total budget ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
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
                      name="dailyBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Daily budget ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
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
                      name="maxCpc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max CPC ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              value={(field.value as number | string) ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <FormField
                    control={form.control}
                    name="targetCountries"
                    render={() => (
                      <FormItem>
                        <FormLabel>Target countries</FormLabel>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {COUNTRIES.map((country) => (
                            <FormField
                              key={country.value}
                              control={form.control}
                              name="targetCountries"
                              render={({ field }) => {
                                const values = field.value ?? []
                                const checked = values.includes(
                                  country.value
                                )
                                return (
                                  <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(isChecked) => {
                                        field.onChange(
                                          isChecked
                                            ? [...values, country.value]
                                            : values.filter(
                                                (v) => v !== country.value
                                              )
                                        )
                                      }}
                                    />
                                    {country.label}
                                  </label>
                                )
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetDevices"
                    render={() => (
                      <FormItem>
                        <FormLabel>Target devices</FormLabel>
                        <div className="grid grid-cols-3 gap-2">
                          {DEVICES.map((device) => (
                            <FormField
                              key={device.value}
                              control={form.control}
                              name="targetDevices"
                              render={({ field }) => {
                                const values = field.value ?? []
                                const checked = values.includes(device.value)
                                return (
                                  <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(isChecked) => {
                                        field.onChange(
                                          isChecked
                                            ? [...values, device.value]
                                            : values.filter(
                                                (v) => v !== device.value
                                              )
                                        )
                                      }}
                                    />
                                    {device.label}
                                  </label>
                                )
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <FormField
                    control={form.control}
                    name="creativeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Creative type</FormLabel>
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
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="html">HTML</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {creativeType === "image" ? (
                    <FormField
                      control={form.control}
                      name="creativeUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Creative URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://cdn.example.com/creative.png"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="creativeHtml"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Creative HTML</FormLabel>
                          <FormControl>
                            <Textarea rows={5} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormDescription>
                          Internal notes for the review team.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : null}
            </CardContent>

            <CardFooter className="justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={step === 0}
              >
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={goNext}>
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting
                    ? "Submitting..."
                    : "Submit campaign"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  )
}
