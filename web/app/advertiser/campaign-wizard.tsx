"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  BellRing,
  Check,
  Code2,
  ImageIcon,
  Layers,
  LayoutTemplate,
  Monitor,
  Smartphone,
  Tablet,
  X,
} from "lucide-react"

import { ApiError, createCampaign, uploadCreativeFile } from "@/lib/api"
import type { Campaign } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AD_FORMAT_CATALOG, getAdFormat } from "@/lib/ad-formats"
import {
  AdvertiseTargetDialog,
  type AdvertiseTarget,
} from "@/app/advertiser/advertise-target-dialog"
import { CountryGlobe } from "@/app/advertiser/country-globe"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AD_FORMATS,
  COUNTRIES,
  DEVICES,
  GROUPED_AD_FORMATS,
  PRICING_MODELS,
  START_MODES,
  campaignSchema,
  type CampaignFormInput,
  type CampaignFormOutput,
} from "@/app/advertiser/campaign-fields"

const DEVICE_ICONS: Record<string, React.ElementType> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
}

// Icons for the three pre-catalog legacy formats (see LEGACY_AD_FORMATS in
// campaign-fields.ts). Every other format's icon comes straight off
// AD_FORMAT_CATALOG, built into AD_FORMAT_ICONS below.
const LEGACY_AD_FORMAT_ICONS: Record<string, React.ElementType> = {
  SOCIAL_BAR: BellRing,
  NATIVE_BANNER: LayoutTemplate,
  IN_PAGE_PUSH: BellRing,
}

const AD_FORMAT_ICONS: Record<string, React.ElementType> = {
  ...LEGACY_AD_FORMAT_ICONS,
  ...Object.fromEntries(AD_FORMAT_CATALOG.map((f) => [f.value, f.icon])),
}

const AD_FORMAT_BADGE: Record<string, string> = {
  POPUNDER: "Popular",
  SOCIAL_BAR: "Best choice",
}

export function CampaignWizard({
  onCreated,
}: {
  onCreated?: (campaign: Campaign) => void
} = {}) {
  const [result, setResult] = React.useState<Campaign | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [showIntake, setShowIntake] = React.useState(true)
  const [advertiseTarget, setAdvertiseTarget] =
    React.useState<AdvertiseTarget | null>(null)
  const [step, setStep] = React.useState(0)

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
      destinationUrl: "",
      notes: "",
      pricingModel: "CPM",
      countryPricing: {},
      locations: [],
      budgetUnlimited: false,
      startMode: "START_ONCE_VERIFIED",
      scheduledAt: "",
    },
  })

  const creativeType = form.watch("creativeType")
  const campaignName = form.watch("campaignName")
  const totalBudget = form.watch("totalBudget")
  const dailyBudget = form.watch("dailyBudget")
  const maxCpc = form.watch("maxCpc")
  const targetCountries = form.watch("targetCountries") ?? []
  const targetDevices = form.watch("targetDevices") ?? []
  const adFormat = form.watch("adFormat")
  const pricingModel = form.watch("pricingModel")
  const countryPricing = form.watch("countryPricing") ?? {}
  const locations = form.watch("locations") ?? []
  const budgetUnlimited = form.watch("budgetUnlimited")
  const startMode = form.watch("startMode")

  // Which ad-format category's tiles to show below the dropdown - defaults
  // to the category of the currently-selected format (if any) so editing an
  // existing campaign doesn't land on an empty-looking picker.
  const [adFormatCategory, setAdFormatCategory] = React.useState<string>(
    () =>
      GROUPED_AD_FORMATS.find((group) =>
        group.formats.some((f) => f.value === form.getValues("adFormat"))
      )?.category ?? GROUPED_AD_FORMATS[0].category
  )

  const [countryToAdd, setCountryToAdd] = React.useState("")
  const [priceToAdd, setPriceToAdd] = React.useState("")
  const [locCountry, setLocCountry] = React.useState("")
  const [locRegion, setLocRegion] = React.useState("")
  const [locCity, setLocCity] = React.useState("")

  const STEPS = [
    {
      title: "General",
      fields: ["campaignName", "targetDevices"] as const,
    },
    {
      title: "Ad format",
      fields: ["adFormat", "pricingModel"] as const,
    },
    {
      title: "Landing & creative",
      fields: [
        "destinationUrl",
        "creativeType",
        "creativeUrl",
        "creativeHtml",
      ] as const,
    },
    {
      title: "Countries",
      fields: ["targetCountries"] as const,
    },
    {
      title: "Locations & notes",
      fields: [] as const,
    },
    {
      title: "Budget & schedule",
      fields: [
        "totalBudget",
        "dailyBudget",
        "maxCpc",
        "startMode",
        "scheduledAt",
      ] as const,
    },
  ]
  const isLastStep = step === STEPS.length - 1

  async function goNext() {
    const valid = await form.trigger(STEPS[step].fields)
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleIntakeSubmit(target: AdvertiseTarget, landingUrl: string) {
    setAdvertiseTarget(target)
    form.setValue("destinationUrl", landingUrl, {
      shouldValidate: true,
      shouldDirty: true,
    })
    setShowIntake(false)
  }

  // Mirrors the backend's ALLOWED_CREATIVE_MIME_TYPES /
  // MAX_CREATIVE_UPLOAD_BYTES (see creative-upload.service.ts) — checked
  // here too so the advertiser gets instant feedback instead of waiting on
  // a round trip for a file the server will reject anyway.
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // allow re-selecting the same file later

    if (!file) return

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Image is too large (max 5 MB)")
      return
    }

    setUploading(true)
    try {
      const { url } = await uploadCreativeFile(file)
      form.setValue("creativeUrl", url, {
        shouldValidate: true,
        shouldDirty: true,
      })
      toast.success("Image uploaded")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
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

  function toggleDevice(value: string) {
    const checked = targetDevices.includes(value)
    form.setValue(
      "targetDevices",
      checked
        ? targetDevices.filter((v) => v !== value)
        : [...targetDevices, value],
      { shouldValidate: true, shouldDirty: true }
    )
  }

  function addCountry() {
    if (!countryToAdd) return
    const price = Number(priceToAdd || 0)
    if (!targetCountries.includes(countryToAdd)) {
      form.setValue("targetCountries", [...targetCountries, countryToAdd], {
        shouldValidate: true,
        shouldDirty: true,
      })
    }
    form.setValue(
      "countryPricing",
      { ...countryPricing, [countryToAdd]: price },
      { shouldDirty: true }
    )
    setCountryToAdd("")
    setPriceToAdd("")
  }

  function removeCountry(code: string) {
    form.setValue(
      "targetCountries",
      targetCountries.filter((v) => v !== code),
      { shouldValidate: true, shouldDirty: true }
    )
    const next = { ...countryPricing }
    delete next[code]
    form.setValue("countryPricing", next, { shouldDirty: true })
  }

  function addLocation() {
    if (!locCountry) return
    form.setValue(
      "locations",
      [
        ...locations,
        {
          country: locCountry,
          region: locRegion || undefined,
          city: locCity || undefined,
          include: true,
        },
      ],
      { shouldDirty: true }
    )
    setLocCountry("")
    setLocRegion("")
    setLocCity("")
  }

  function removeLocation(index: number) {
    form.setValue(
      "locations",
      locations.filter((_, i) => i !== index),
      { shouldDirty: true }
    )
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
            <p className="text-base text-foreground">
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
                setAdvertiseTarget(null)
                setShowIntake(true)
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
    <div className="mx-auto max-w-6xl">
      <AdvertiseTargetDialog open={showIntake} onSubmit={handleIntakeSubmit} />

      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">
          Create campaign
        </h2>
        <ol className="mt-4 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
                i === step
                  ? "border-orange-500 bg-orange-500/5 text-foreground"
                  : i < step
                    ? "border-border text-foreground"
                    : "border-border text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  i <= step
                    ? "bg-orange-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              {s.title}
            </li>
          ))}
        </ol>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
        >
          <div className="space-y-10">
            {step === 0 ? (
            <>
            <div>
              <h3 className="text-base font-semibold">Required Settings*</h3>
            </div>

            <SettingsRow label="General">
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
            </SettingsRow>

            <SettingsRow
              label="Devices"
              description="Choose one format or combine several."
            >
              <FormField
                control={form.control}
                name="targetDevices"
                render={() => (
                  <FormItem>
                    <div className="grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3">
                      {DEVICES.map((device) => (
                        <OptionTile
                          key={device.value}
                          icon={DEVICE_ICONS[device.value] ?? Monitor}
                          label={device.label}
                          selected={targetDevices.includes(device.value)}
                          onClick={() => toggleDevice(device.value)}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsRow>

            </>
            ) : null}

            {step === 1 ? (
            <>
            <div>
              <h3 className="text-base font-semibold">Ad format</h3>
            </div>

            <SettingsRow
              label="Ad unit & Pricing type"
              description="Pick the ad format and how it's billed."
            >
              <FormField
                control={form.control}
                name="adFormat"
                render={() => {
                  const activeGroup =
                    GROUPED_AD_FORMATS.find(
                      (group) => group.category === adFormatCategory
                    ) ?? GROUPED_AD_FORMATS[0]

                  return (
                    <FormItem>
                      <div className="space-y-4">
                        <Select
                          value={adFormatCategory}
                          onValueChange={setAdFormatCategory}
                        >
                          <SelectTrigger className="w-full sm:w-64">
                            <SelectValue placeholder="Choose an ad type" />
                          </SelectTrigger>
                          <SelectContent>
                            {GROUPED_AD_FORMATS.map((group) => (
                              <SelectItem
                                key={group.category}
                                value={group.category}
                              >
                                {group.category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {activeGroup.formats.map((format) => (
                            <AdUnitTile
                              key={format.value}
                              icon={AD_FORMAT_ICONS[format.value] ?? Layers}
                              label={format.label}
                              sublabel={
                                getAdFormat(format.value)
                                  ? `${getAdFormat(format.value)!.recommendedWidth}×${
                                      getAdFormat(format.value)!.recommendedHeight
                                    }`
                                  : undefined
                              }
                              description={getAdFormat(format.value)?.description}
                              badge={AD_FORMAT_BADGE[format.value]}
                              selected={adFormat === format.value}
                              onClick={() =>
                                form.setValue("adFormat", format.value, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {PRICING_MODELS.map((model) => (
                  <RadioPill
                    key={model}
                    label={model}
                    selected={pricingModel === model}
                    onClick={() =>
                      form.setValue("pricingModel", model, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                ))}
              </div>
            </SettingsRow>
            </>
            ) : null}

            {step === 2 ? (
            <>
            <SettingsRow
              label="Landing URL & Preview"
              description="Where people land when they click this ad."
            >
              <FormField
                control={form.control}
                name="destinationUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Landing URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://fakirefashion.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="creativeType"
                  render={() => (
                    <FormItem>
                      <FormLabel>Creative type</FormLabel>
                      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                        <OptionTile
                          icon={ImageIcon}
                          label="Image"
                          selected={creativeType === "image"}
                          onClick={() =>
                            form.setValue("creativeType", "image", {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }
                        />
                        <OptionTile
                          icon={Code2}
                          label="HTML"
                          selected={creativeType === "html"}
                          onClick={() =>
                            form.setValue("creativeType", "html", {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {creativeType === "image" ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <FormLabel>Upload image</FormLabel>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        disabled={uploading}
                        onChange={handleFileSelected}
                      />
                      <p className="text-base text-foreground">
                        {uploading
                          ? "Uploading..."
                          : "PNG, JPEG, GIF or WEBP, up to 5 MB. Fills the URL below automatically — or paste one yourself."}
                      </p>
                    </div>

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

                    {form.watch("creativeUrl") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- previewing an arbitrary external URL, not a static asset
                      <img
                        src={form.watch("creativeUrl")}
                        alt="Creative preview"
                        className="max-h-48 rounded-md border object-contain"
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                        onLoad={(event) => {
                          event.currentTarget.style.display = "block"
                        }}
                      />
                    ) : null}
                  </div>
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
              </div>
            </SettingsRow>
            </>
            ) : null}

            {step === 3 ? (
            <>
            <SettingsRow
              label="Countries"
              description="Pick a country — it lights up on the globe."
            >
              <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="grid gap-1.5">
                      <FormLabel>Countries</FormLabel>
                      <Select
                        value={countryToAdd}
                        onValueChange={setCountryToAdd}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Choose a country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem
                              key={country.value}
                              value={country.value}
                            >
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <FormLabel>Price</FormLabel>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28"
                        placeholder="0.00"
                        value={priceToAdd}
                        onChange={(e) => setPriceToAdd(e.target.value)}
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={addCountry}>
                      Add country
                    </Button>
                  </div>

                  {targetCountries.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {targetCountries.map((code) => {
                        const label =
                          COUNTRIES.find((c) => c.value === code)?.label ??
                          code
                        return (
                          <Badge key={code} variant="outline" className="gap-1.5">
                            {label}
                            {countryPricing[code] !== undefined
                              ? ` · $${countryPricing[code]}`
                              : ""}
                            <button
                              type="button"
                              onClick={() => removeCountry(code)}
                              aria-label={`Remove ${label}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        )
                      })}
                    </div>
                  ) : null}
                  <FormField
                    control={form.control}
                    name="targetCountries"
                    render={() => <FormMessage />}
                  />
                </div>

                <CountryGlobe
                  selectedCountries={targetCountries}
                  highlightedCountry={countryToAdd || undefined}
                />
              </div>
            </SettingsRow>
            </>
            ) : null}

            {step === 4 ? (
            <>
            <SettingsRow
              label="Locations"
              description="Include or exclude specific regions/cities."
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <FormLabel>Country</FormLabel>
                  <Select value={locCountry} onValueChange={setLocCountry}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Choose a country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <FormLabel>Region</FormLabel>
                  <Input
                    className="w-32"
                    placeholder="Optional"
                    value={locRegion}
                    onChange={(e) => setLocRegion(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <FormLabel>City</FormLabel>
                  <Input
                    className="w-32"
                    placeholder="Optional"
                    value={locCity}
                    onChange={(e) => setLocCity(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={addLocation}>
                  Add location
                </Button>
              </div>

              {locations.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {locations.map((loc, i) => (
                    <Badge key={i} variant="outline" className="gap-1.5">
                      {[loc.country, loc.region, loc.city]
                        .filter(Boolean)
                        .join(" / ")}
                      <button
                        type="button"
                        onClick={() => removeLocation(i)}
                        aria-label="Remove location"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </SettingsRow>

            <Separator />

            <SettingsRow label="Notes" description="Internal notes for the review team.">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsRow>
            </>
            ) : null}

            {step === 5 ? (
            <>
            <div>
              <h3 className="text-base font-semibold">Budget & schedule</h3>
            </div>

            <SettingsRow label="Total budget">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="budgetUnlimited"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Unlimited budget</FormLabel>
                    </FormItem>
                  )}
                />

                {!budgetUnlimited ? (
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
                ) : null}
              </div>
            </SettingsRow>

            <Separator />

            <SettingsRow
              label="Choose a start time"
              description="We will start the campaign right after its verification, which may take from 3 to 12 hours."
            >
              <div className="flex flex-wrap gap-2">
                {START_MODES.map((mode) => (
                  <RadioPill
                    key={mode.value}
                    label={mode.label}
                    selected={startMode === mode.value}
                    onClick={() =>
                      form.setValue("startMode", mode.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                ))}
              </div>

              {startMode === "SCHEDULE" ? (
                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem className="mt-3 max-w-xs">
                      <FormLabel>Scheduled for</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </SettingsRow>
            </>
            ) : null}

            <div className="flex items-center justify-between border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={step === 0}
              >
                Back
              </Button>
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={goNext}
                  className="brand-gradient text-white"
                >
                  Next
                </Button>
              ) : null}
            </div>
          </div>

          <aside className="lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign summary</CardTitle>
                <CardDescription>
                  Review your settings before submitting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-base">
                {advertiseTarget ? (
                  <SummaryRow
                    label="Advertising"
                    value={
                      advertiseTarget === "social_media"
                        ? "Social media"
                        : advertiseTarget === "app"
                          ? "App"
                          : "Website"
                    }
                  />
                ) : null}
                <SummaryRow
                  label="Name"
                  value={campaignName || "Untitled campaign"}
                />
                <SummaryRow
                  label="Ad unit"
                  value={
                    adFormat
                      ? (AD_FORMATS.find((f) => f.value === adFormat)?.label ??
                        adFormat)
                      : "Not selected"
                  }
                />
                <SummaryRow
                  label="Pricing type"
                  value={pricingModel ?? "CPM"}
                />
                <SummaryRow
                  label="Budget"
                  value={
                    budgetUnlimited
                      ? "Unlimited"
                      : `$${Number(totalBudget || 0).toFixed(2)} total`
                  }
                />
                {!budgetUnlimited ? (
                  <>
                    <SummaryRow
                      label="Daily budget"
                      value={`$${Number(dailyBudget || 0).toFixed(2)}`}
                    />
                    <SummaryRow
                      label="Max CPC"
                      value={`$${Number(maxCpc || 0).toFixed(2)}`}
                    />
                  </>
                ) : null}
                <SummaryRow
                  label="Devices"
                  value={
                    targetDevices.length > 0
                      ? `${targetDevices.length} selected`
                      : "None selected"
                  }
                />
                <SummaryRow
                  label="Countries"
                  value={
                    targetCountries.length > 0
                      ? `${targetCountries.length} selected`
                      : "None selected"
                  }
                />
                <SummaryRow
                  label="Start"
                  value={
                    START_MODES.find((m) => m.value === startMode)?.label ??
                    startMode ??
                    "Start once verified"
                  }
                />
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2">
                {isLastStep ? (
                  <Button
                    type="submit"
                    className="w-full brand-gradient text-white"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting
                      ? "Submitting..."
                      : "Proceed to review"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full brand-gradient text-white"
                    onClick={goNext}
                  >
                    Next
                  </Button>
                )}
                <p className="text-center text-sm text-foreground">
                  Submitted campaigns are reviewed before going live.
                </p>
              </CardFooter>
            </Card>
          </aside>
        </form>
      </Form>
    </div>
  )
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
      <div>
        <p className="text-base font-medium text-foreground">{label}</p>
        {description ? (
          <p className="mt-1 text-sm text-foreground">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function OptionTile({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ElementType
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-base font-medium transition-colors",
        selected
          ? "border-blue-500 tile-shade text-foreground"
          : "border-border text-foreground tile-hover hover:border-blue-500"
      )}
    >
      {selected ? (
        <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      <Icon className="size-5" />
      {label}
    </button>
  )
}

function AdUnitTile({
  icon: Icon,
  label,
  sublabel,
  description,
  badge,
  selected,
  onClick,
}: {
  icon: React.ElementType
  label: string
  sublabel?: string
  description?: string
  badge?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      title={description}
      className={cn(
        "relative aspect-square flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center text-base font-medium transition-colors",
        selected
          ? "border-blue-500 tile-shade text-foreground"
          : "border-border text-foreground tile-hover hover:border-blue-500"
      )}
    >
      {badge ? (
        <Badge className="absolute -top-2 right-2" variant="secondary">
          {badge}
        </Badge>
      ) : null}
      {selected ? (
        <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      <Icon className="size-6" />
      <span>{label}</span>
      {sublabel ? (
        <span className="text-sm font-normal text-foreground">
          {sublabel}
        </span>
      ) : null}
    </button>
  )
}

function RadioPill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-base font-medium transition-colors",
        selected
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-border text-foreground hover:border-foreground/30"
      )}
    >
      {label}
    </button>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-semibold">
        {value}
      </span>
    </div>
  )
}
