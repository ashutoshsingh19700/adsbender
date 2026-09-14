"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  AppWindow,
  ArrowRight,
  BellRing,
  Check,
  CircleDollarSign,
  Clock,
  Code2,
  Coins,
  Crown,
  Eye,
  FileText,
  Globe,
  ImageIcon,
  Info,
  Layers,
  LayoutTemplate,
  MapPin,
  Maximize2,
  MousePointerClick,
  PanelRight,
  PlayCircle,
  Sparkles,
  Tag,
  Target,
  Video,
  Wallet,
  X,
} from "lucide-react"

import {
  ApiError,
  createCampaign,
  deleteCampaignDraft,
  getAdFormatPricing,
  getAvailableCountries,
  getCampaignDraft,
  saveCampaignDraft,
  uploadCreativeFile,
  type AdFormatPricing,
} from "@/lib/api"
import type { Campaign } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AD_FORMAT_CATALOG, getAdFormat } from "@/lib/ad-formats"
import { AdFormatDevicePreview } from "@/components/app/ad-format-device-preview"
import {
  AdvertiseTargetDialog,
  type AdvertiseTarget,
} from "@/app/advertiser/advertise-target-dialog"
import { CountryGlobe, preloadCountryGlobe } from "@/app/advertiser/country-globe"
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
  ALL_DEVICE_VALUES,
  ALL_OS_VALUES,
  COUNTRIES,
  countryFlag,
  GROUPED_AD_FORMATS,
  PRICING_MODELS,
  START_MODES,
  campaignSchema,
  type CampaignFormInput,
  type CampaignFormOutput,
} from "@/app/advertiser/campaign-fields"

// One icon per ad-format category, shown in the vertical rail on the ad
// format step (see GROUPED_AD_FORMATS in campaign-fields.ts).
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Legacy: BellRing,
  "Display Ads": LayoutTemplate,
  "Sidebar Ads": PanelRight,
  "Native Ads": FileText,
  "Popup & Overlay Ads": AppWindow,
  "Interstitial Ads": Maximize2,
  "Video Ads": PlayCircle,
  "Premium Inventory": Crown,
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

// getAdFormat() only knows the shared catalog, so the three legacy formats
// (predate it — see LEGACY_AD_FORMATS in campaign-fields.ts) need their own
// description copy for the ad-unit tiles below.
const LEGACY_AD_FORMAT_DESCRIPTIONS: Record<string, string> = {
  SOCIAL_BAR: "Engage users with non-intrusive notifications.",
  NATIVE_BANNER: "Blend seamlessly with site content.",
  IN_PAGE_PUSH: "Deliver messages while users are on your site.",
}

const START_MODE_DESCRIPTIONS: Record<string, string> = {
  START_ONCE_VERIFIED:
    "We'll launch your campaign after verification.",
  SCHEDULE: "Pick a date and time for launch.",
  KEEP_INACTIVE: "Save as draft and launch later.",
}

// The Landing URL field always sends "https://<rest>" to the form - this
// strips a leading http(s):// back off so the input only ever shows the
// part the advertiser actually typed.
function stripHttps(value: string) {
  return value.replace(/^https?:\/\//i, "")
}

const PRICING_MODEL_META: Record<
  (typeof PRICING_MODELS)[number],
  { icon: React.ElementType; description: string }
> = {
  CPM: { icon: Eye, description: "Cost per 1,000 impressions" },
  CPA: { icon: Target, description: "Cost per acquisition" },
  CPC: { icon: MousePointerClick, description: "Cost per click" },
}

export function CampaignWizard({
  onCreated,
  onCancel,
}: {
  onCreated?: (campaign: Campaign) => void
  onCancel?: () => void
} = {}) {
  const [result, setResult] = React.useState<Campaign | null>(null)
  const [uploading, setUploading] = React.useState(false)
  // Shown in red next to the upload input only once a file actually exceeds
  // the size limit - cleared on creative-type switch or a valid upload.
  const [uploadSizeError, setUploadSizeError] = React.useState<string | null>(
    null
  )
  const [showIntake, setShowIntake] = React.useState(true)
  const [advertiseTargets, setAdvertiseTargets] =
    React.useState<AdvertiseTarget[]>([])
  const [step, setStep] = React.useState(0)
  const [adFormatPricing, setAdFormatPricing] =
    React.useState<AdFormatPricing>({})
  // Countries the network actually has publisher supply in - null means "no
  // restriction reported yet", in which case every entry in COUNTRIES stays
  // pickable rather than the wizard blocking targeting outright. See
  // AdvertiserService.getAvailableCountries on the backend.
  const [availableCountryCodes, setAvailableCountryCodes] = React.useState<
    string[] | null
  >(null)
  const pickableCountries = React.useMemo(
    () =>
      availableCountryCodes
        ? COUNTRIES.filter((c) => availableCountryCodes.includes(c.value))
        : COUNTRIES,
    [availableCountryCodes]
  )

  React.useEffect(() => {
    getAdFormatPricing()
      .then(setAdFormatPricing)
      .catch(() => {
        // Non-fatal - the wizard still works without rate previews, they
        // just won't render until this succeeds.
      })
    getAvailableCountries()
      .then(({ countries }) => setAvailableCountryCodes(countries))
      .catch(() => {
        // Non-fatal - falls back to every country in COUNTRIES.
      })
    // Warm up the globe's chunk as soon as the wizard opens, well before the
    // advertiser reaches the Countries step - avoids a blank/loading globe
    // on arrival.
    preloadCountryGlobe()
  }, [])

  const form = useForm<CampaignFormInput, unknown, CampaignFormOutput>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaignName: "",
      totalBudget: 100,
      dailyBudget: 20,
      maxCpc: 0.5,
      targetCountries: [],
      // No device/OS/connection picker in the wizard anymore - every
      // campaign targets everything by default (see ALL_DEVICE_VALUES /
      // ALL_OS_VALUES in campaign-fields.ts).
      targetDevices: [...ALL_DEVICE_VALUES],
      targetOperatingSystems: [...ALL_OS_VALUES],
      connectionType: "ALL",
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

  // --- Draft autosave / restore ---
  // The whole in-progress wizard is periodically saved to the backend (see
  // saveCampaignDraft) so a refresh, a closed tab, a dropped connection, or
  // even a different browser/device never loses it - restorable any time
  // until the campaign is actually submitted. `draftChecked` gates the
  // autosave effect below so it can't fire (and overwrite a real saved
  // draft with blank defaults) before the initial fetch resolves.
  const [pendingDraft, setPendingDraft] = React.useState<CampaignFormInput | null>(
    null
  )
  const [pendingDraftAt, setPendingDraftAt] = React.useState<string | undefined>()
  const draftChecked = React.useRef(false)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  React.useEffect(() => {
    getCampaignDraft()
      .then(({ draft, updatedAt }) => {
        if (draft && Object.keys(draft).length > 0) {
          setPendingDraft(draft as CampaignFormInput)
          setPendingDraftAt(updatedAt)
        }
      })
      .catch(() => {
        // Non-fatal - the wizard still works, just without a draft to offer.
      })
      .finally(() => {
        draftChecked.current = true
      })
  }, [])

  function restoreDraft() {
    if (!pendingDraft) return
    form.reset(pendingDraft)
    if (pendingDraft.destinationUrl) setShowIntake(false)
    const category = GROUPED_AD_FORMATS.find((group) =>
      group.formats.some((f) => f.value === pendingDraft.adFormat)
    )?.category
    if (category) setAdFormatCategory(category)
    setPendingDraft(null)
  }

  function discardDraft() {
    setPendingDraft(null)
    deleteCampaignDraft().catch(() => {
      // Non-fatal - it'll just get overwritten by the next autosave.
    })
  }

  // Debounced autosave: any change to the form (after the initial draft
  // check) schedules a save ~1.5s later, coalescing rapid typing into one
  // request instead of one per keystroke.
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      if (!draftChecked.current || pendingDraft || result) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveCampaignDraft(value as Record<string, unknown>).catch(() => {
          // Non-fatal - next change retries; worst case is losing the very
          // latest edits if the tab closes before a save lands.
        })
      }, 1500)
    })
    return () => {
      subscription.unsubscribe()
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form is stable from useForm()
  }, [pendingDraft, result])

  const [countryToAdd, setCountryToAdd] = React.useState("")
  const [priceToAdd, setPriceToAdd] = React.useState("0.05")
  const [locCountry, setLocCountry] = React.useState("")
  const [locRegion, setLocRegion] = React.useState("")
  const [locCity, setLocCity] = React.useState("")

  const STEPS = [
    {
      title: "Ad format",
      fields: ["campaignName", "adFormat", "pricingModel"] as const,
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
      // Region/city refinement + review notes folded into this step - see
      // the note further down where they're rendered.
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
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
      return
    }

    // form.trigger() flags invalid fields but never brings them into view.
    // On a long step the first error can render well above the fold while
    // "Save & Next" sits at the bottom, so clicking it looks like nothing
    // happened. Scroll/focus the first invalid field and say why, once the
    // error markup has actually painted.
    toast.error("Please fix the highlighted fields before continuing.")
    requestAnimationFrame(() => {
      const firstInvalid = document.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      )
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" })
      firstInvalid?.focus?.()
    })
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleIntakeSubmit(targets: AdvertiseTarget[], landingUrl: string) {
    setAdvertiseTargets(targets)
    form.setValue("destinationUrl", landingUrl, {
      shouldValidate: true,
      shouldDirty: true,
    })
    setShowIntake(false)
  }

  // Mirrors the backend's ALLOWED_CREATIVE_MIME_TYPES /
  // MAX_CREATIVE_UPLOAD_BYTES / MAX_VIDEO_CREATIVE_UPLOAD_BYTES (see
  // creative-upload.service.ts) — checked here too so the advertiser gets
  // instant feedback instead of waiting on a round trip for a file the
  // server will reject anyway.
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
  const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // allow re-selecting the same file later

    if (!file) return

    const isVideo = file.type.startsWith("video/")
    const maxBytes = isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES
    if (file.size > maxBytes) {
      const message = `${isVideo ? "Video" : "Image"} is too large (max ${maxBytes / (1024 * 1024)} MB)`
      setUploadSizeError(message)
      toast.error(message)
      return
    }

    setUploadSizeError(null)
    setUploading(true)
    try {
      const { url } = await uploadCreativeFile(file)
      form.setValue("creativeUrl", url, {
        shouldValidate: true,
        shouldDirty: true,
      })
      toast.success(isVideo ? "Video uploaded" : "Image uploaded")
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

  function clearAllCountries() {
    form.setValue("targetCountries", [], { shouldValidate: true, shouldDirty: true })
    form.setValue("countryPricing", {}, { shouldDirty: true })
  }

  // Clicking a pin directly on the globe toggles that country - lets the
  // advertiser build up a target list without touching the dropdown at all.
  function togglePinCountry(code: string) {
    if (targetCountries.includes(code)) {
      removeCountry(code)
      return
    }
    form.setValue("targetCountries", [...targetCountries, code], {
      shouldValidate: true,
      shouldDirty: true,
    })
    form.setValue(
      "countryPricing",
      { ...countryPricing, [code]: Number(priceToAdd || 0.05) },
      { shouldDirty: true }
    )
    setCountryToAdd(code)
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
                setAdvertiseTargets([])
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

  const STEP_DESCRIPTIONS = [
    "Name your campaign and choose the ad format and how it's billed.",
    "Set the landing page and upload your creative.",
    "Pick the countries you want to advertise in.",
    "Set your budget, schedule, and any location or review notes.",
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <AdvertiseTargetDialog
        // Held back while a saved draft is waiting on a restore/discard
        // decision - otherwise this modal would cover the banner asking
        // for that decision.
        open={showIntake && !pendingDraft}
        onSubmit={handleIntakeSubmit}
        onClose={onCancel}
      />

      <p className="text-sm text-muted-foreground">
        Campaigns <span className="mx-1">›</span> New Campaign
      </p>

      {pendingDraft ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm text-foreground">
            We found a saved draft
            {pendingDraftAt
              ? ` from ${new Date(pendingDraftAt).toLocaleString()}`
              : ""}
            . Resume where you left off?
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={discardDraft}>
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              className="brand-gradient text-white"
              onClick={restoreDraft}
            >
              Restore draft
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative mt-2 mb-8 overflow-hidden rounded-3xl border bg-gradient-to-br from-indigo-50 via-violet-50/60 to-white p-6 sm:p-8">
        <div className="relative z-10 flex items-start gap-4">
          <span className="sidebar-pill-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-fuchsia-900/10">
            <span className="block size-3.5 rotate-45 rounded-[3px] bg-white" />
          </span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Create campaign
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {STEP_DESCRIPTIONS[step]}
            </p>
          </div>
        </div>

        <div className="pointer-events-none absolute right-6 top-6 hidden items-center gap-2 text-sm font-medium text-violet-500/70 sm:flex">
          <span className="italic">Reach global audiences</span>
          <MapPin className="size-4" />
        </div>
        <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-gradient-to-br from-violet-200/50 to-fuchsia-200/40 blur-2xl" />

        <ol className="relative z-10 mt-7 flex flex-wrap items-center gap-x-1 gap-y-3 sm:flex-nowrap">
          {STEPS.map((s, i) => {
            const status = i < step ? "done" : i === step ? "active" : "upcoming"
            return (
              <React.Fragment key={s.title}>
                <li
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium",
                    status === "active" && "brand-gradient text-white shadow-sm"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      status === "active"
                        ? "bg-white/25 text-white"
                        : status === "done"
                          ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {status === "done" ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      status === "active"
                        ? "text-white"
                        : status === "done"
                          ? "text-violet-600"
                          : "text-muted-foreground"
                    )}
                  >
                    {s.title}
                  </span>
                </li>
                {i < STEPS.length - 1 ? (
                  <ArrowRight className="hidden size-3.5 shrink-0 text-muted-foreground/50 sm:block" />
                ) : null}
              </React.Fragment>
            )
          })}
        </ol>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "grid gap-8 lg:items-start",
            step === 3 ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-1",
          )}
        >
          <div className="space-y-10">
            {step === 0 ? (
            <>
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
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">
                        Ad format
                      </h3>
                      <p className="mt-1 text-sm text-foreground">
                        Choose the ad format and how it&apos;s billed.
                      </p>
                    </div>

                    <div className="mt-5 flex flex-col gap-6 lg:flex-row">
                      <div className="flex flex-1 gap-4">
                        {/* Category rail - one icon per ad-unit category; pick
                            one to reveal its tiles alongside it. Replaces the
                            old dropdown so every category is visible at a
                            glance instead of hidden behind a click. */}
                        <div className="flex shrink-0 flex-col gap-1.5">
                          {GROUPED_AD_FORMATS.map((group) => {
                            const Icon = CATEGORY_ICONS[group.category] ?? Layers
                            const active = group.category === adFormatCategory
                            return (
                              <button
                                key={group.category}
                                type="button"
                                title={group.category}
                                aria-label={group.category}
                                aria-pressed={active}
                                onClick={() => setAdFormatCategory(group.category)}
                                className={cn(
                                  "flex size-11 items-center justify-center rounded-xl border transition-colors sm:size-12",
                                  active
                                    ? "tile-select"
                                    : "border-border text-muted-foreground tile-select-hover"
                                )}
                              >
                                <Icon className="size-5" />
                              </button>
                            )
                          })}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="mb-3 text-sm font-medium text-foreground">
                            {activeGroup.category}
                          </p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                description={
                                  getAdFormat(format.value)?.description ??
                                  LEGACY_AD_FORMAT_DESCRIPTIONS[format.value]
                                }
                                badge={AD_FORMAT_BADGE[format.value]}
                                rate={adFormatPricing[format.value]}
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
                      </div>

                      {/* Real preview of the currently-selected format on a
                          phone/laptop screen, not just the dimensions - see
                          components/app/ad-format-device-preview.tsx. */}
                      <AdFormatDevicePreview
                        format={getAdFormat(adFormat)}
                        className="w-full shrink-0 lg:w-[280px]"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            <div>
              <h3 className="text-base font-semibold">Pricing type</h3>
              <p className="mt-1 text-sm text-foreground">
                Select how you want to be billed for this campaign.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PRICING_MODELS.map((model) => (
                  <PricingCard
                    key={model}
                    icon={PRICING_MODEL_META[model].icon}
                    label={model}
                    description={PRICING_MODEL_META[model].description}
                    price={
                      adFormat
                        ? adFormatPricing[adFormat]?.[
                            model.toLowerCase() as "cpm" | "cpa" | "cpc"
                          ]
                        : undefined
                    }
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
            </div>
            </>
            ) : null}

            {step === 1 ? (  /* Landing & creative */
            <>
            {getAdFormat(adFormat)?.renderFamily === "newsletter" ? (
              <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground">
                <p className="font-medium">Delivered as a copy-paste HTML snippet</p>
                <p className="mt-1 text-muted-foreground">
                  Newsletter Sponsorship doesn&apos;t run through a publisher&apos;s live JS tag
                  (email clients block scripts). Instead, the publisher pastes a static HTML
                  snippet built from this creative into their email tool - the same image/HTML
                  and landing URL below, plus a working open-tracking pixel and click link.
                </p>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <SettingsRow
                label="Landing URL"
                description="Where people land when they click this ad."
              >
                <FormField
                  control={form.control}
                  name="destinationUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landing URL</FormLabel>
                      <FormControl>
                        {/* https:// is fixed - the advertiser only types the
                            rest of the address. */}
                        <div className="flex items-stretch overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                          <span className="flex items-center border-r bg-muted px-3 text-sm text-muted-foreground">
                            https://
                          </span>
                          <input
                            className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                            placeholder="fakirefashion.com"
                            value={stripHttps(field.value ?? "")}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? `https://${stripHttps(e.target.value)}`
                                  : ""
                              )
                            }
                            onBlur={field.onBlur}
                          />
                        </div>
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
                        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
                          <OptionTile
                            icon={ImageIcon}
                            label="Image"
                            selected={creativeType === "image"}
                            onClick={() => {
                              setUploadSizeError(null)
                              form.setValue("creativeType", "image", {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }}
                          />
                          <OptionTile
                            icon={Video}
                            label="Video"
                            selected={creativeType === "video"}
                            onClick={() => {
                              setUploadSizeError(null)
                              form.setValue("creativeType", "video", {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }}
                          />
                          <OptionTile
                            icon={Code2}
                            label="HTML"
                            selected={creativeType === "html"}
                            onClick={() => {
                              setUploadSizeError(null)
                              form.setValue("creativeType", "html", {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {creativeType === "image" || creativeType === "video" ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <FormLabel>
                          {creativeType === "video" ? "Upload video" : "Upload image"}
                        </FormLabel>
                        <Input
                          type="file"
                          accept={
                            creativeType === "video"
                              ? "video/mp4,video/webm"
                              : "image/png,image/jpeg,image/gif,image/webp"
                          }
                          disabled={uploading}
                          onChange={handleFileSelected}
                        />
                        {/* The size limit only shows up once it's actually
                            been hit - no permanent "up to 5 MB" clutter. */}
                        {uploading ? (
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        ) : uploadSizeError ? (
                          <p className="text-sm font-medium text-destructive">
                            {uploadSizeError}
                          </p>
                        ) : null}
                      </div>

                      <FormField
                        control={form.control}
                        name="creativeUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Creative URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={
                                  creativeType === "video"
                                    ? "https://cdn.example.com/creative.mp4"
                                    : "https://cdn.example.com/creative.png"
                                }
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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

              {/* Preview lives in the empty space to the right instead of
                  stacked under the form. */}
              <div className="flex min-h-[220px] flex-col rounded-2xl border bg-muted/20 p-5">
                <p className="mb-3 text-sm font-semibold text-foreground">Preview</p>
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-background p-4">
                  {creativeType === "html" ? (
                    <p className="text-center text-sm text-muted-foreground">
                      HTML creatives don&apos;t have a visual preview here.
                    </p>
                  ) : form.watch("creativeUrl") ? (
                    creativeType === "video" ? (
                      <video
                        src={form.watch("creativeUrl")}
                        controls
                        muted
                        playsInline
                        className="max-h-64 max-w-full rounded-md"
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                        onLoadedData={(event) => {
                          event.currentTarget.style.display = "block"
                        }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- previewing an arbitrary external URL, not a static asset
                      <img
                        src={form.watch("creativeUrl")}
                        alt="Creative preview"
                        className="max-h-64 max-w-full rounded-md object-contain"
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                        onLoad={(event) => {
                          event.currentTarget.style.display = "block"
                        }}
                      />
                    )
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">
                      Upload or paste a creative URL to see it here.
                    </p>
                  )}
                </div>
              </div>
            </div>
            </>
            ) : null}

            {step === 2 ? (  /* Countries */
            <>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_440px]">
                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600">
                      <Globe className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-foreground">
                        Countries
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Pick a country — it lights up on the globe.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <FormLabel>Country</FormLabel>
                      <Select
                        value={countryToAdd}
                        onValueChange={setCountryToAdd}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a country" />
                        </SelectTrigger>
                        <SelectContent>
                          {pickableCountries.map((country) => (
                            <SelectItem
                              key={country.value}
                              value={country.value}
                            >
                              <span className="mr-1.5">
                                {countryFlag(country.value)}
                              </span>
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <FormLabel
                        className="flex items-center gap-1"
                        title="Your bid for this country - what you're willing to pay per unit of the pricing model you picked (e.g. per 1,000 impressions for CPM). Overrides your default Max CPC for that country; countries you don't set this for fall back to it."
                      >
                        Price (USD)
                        <Info className="size-3.5 text-muted-foreground" />
                      </FormLabel>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.05"
                        value={priceToAdd}
                        onChange={(e) => setPriceToAdd(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={addCountry}
                      className="brand-gradient text-white"
                    >
                      Add country
                    </Button>
                  </div>

                  <div className="mt-7">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        Selected countries ({targetCountries.length})
                      </p>
                      {targetCountries.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearAllCountries}
                          className="text-sm font-medium text-indigo-600 hover:underline"
                        >
                          Clear all
                        </button>
                      ) : null}
                    </div>

                    {targetCountries.length > 0 ? (
                      <div className="mt-2 divide-y overflow-hidden rounded-xl border">
                        {targetCountries.map((code) => {
                          const label =
                            COUNTRIES.find((c) => c.value === code)?.label ??
                            code
                          return (
                            <div
                              key={code}
                              className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <span className="text-lg leading-none">
                                  {countryFlag(code)}
                                </span>
                                {label}
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-foreground">
                                  ${Number(countryPricing[code] ?? 0).toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeCountry(code)}
                                  aria-label={`Remove ${label}`}
                                  className="text-muted-foreground transition-colors hover:text-destructive"
                                >
                                  <X className="size-4" />
                                </button>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No countries selected yet.
                      </p>
                    )}
                    <FormField
                      control={form.control}
                      name="targetCountries"
                      render={() => <FormMessage className="mt-2" />}
                    />
                  </div>

                  <div className="mt-7 flex gap-3 rounded-xl border border-sky-100 bg-sky-50 p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-sky-600 shadow-sm">
                      <Globe className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Tip</p>
                      <p className="text-sm text-muted-foreground">
                        You can add multiple countries to target a global
                        audience.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center bg-gradient-to-br from-sky-50 via-indigo-50/30 to-white p-6 sm:p-8 lg:border-l">
                  <CountryGlobe
                    selectedCountries={targetCountries}
                    highlightedCountry={countryToAdd || undefined}
                    onToggleCountry={togglePinCountry}
                    pickableCountries={pickableCountries}
                  />
                </div>
              </div>
            </div>
            </>
            ) : null}

            {step === 3 ? (  /* Budget & schedule */
            <>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="border-b p-6 sm:p-7">
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Budget settings
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Set a budget that fits your goals.
                </p>
              </div>

              <div className="space-y-5 p-6 sm:p-7">
                <FormField
                  control={form.control}
                  name="budgetUnlimited"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="size-4 accent-violet-600"
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
          <FormLabel>Total budget (USD)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min={10}
                                className="pl-6"
                                {...field}
                                value={(field.value as number | string) ?? ""}
                              />
                            </div>
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Minimum $10 - also the free wallet balance needed to launch.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dailyBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Daily budget (USD)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                className="pl-6"
                                {...field}
                                value={(field.value as number | string) ?? ""}
                              />
                            </div>
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
                          <FormLabel>Max CPC (USD)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                className="pl-6"
                                {...field}
                                value={(field.value as number | string) ?? ""}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex items-start gap-3 border-b p-6 sm:p-7">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-rose-100 text-orange-600">
                  <Clock className="size-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    Start time
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Choose when you want your campaign to go live.
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-7">
                <div className="grid gap-3 sm:grid-cols-3">
                  {START_MODES.map((mode) => (
                    <StartModeCard
                      key={mode.value}
                      label={mode.label}
                      description={START_MODE_DESCRIPTIONS[mode.value]}
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
                      <FormItem className="mt-4 max-w-xs">
                        <FormLabel>Scheduled for</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex items-start gap-3 border-b p-6 sm:p-7">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-600">
                  <MapPin className="size-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    Locations &amp; notes
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Optional - narrow targeting to specific regions/cities, or
                    leave a note for the review team.
                  </p>
                </div>
              </div>

              <div className="space-y-5 p-6 sm:p-7">
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
                          {pickableCountries.map((country) => (
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
              </div>
            </div>
            </>
            ) : null}

            <div className="flex items-center justify-between border-t pt-6">
              {step === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="gap-1.5 rounded-full"
                >
                  <ArrowRight className="size-4 rotate-180" />
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="gap-1.5 rounded-full"
                >
                  <ArrowRight className="size-4 rotate-180" />
                  Back
                </Button>
              )}
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={goNext}
                  className="brand-gradient gap-1.5 rounded-full text-white"
                >
                  Save &amp; Next
                  <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {step === 3 ? (  /* Summary sidebar */
          <aside className="lg:sticky lg:top-6">
            <Card className="overflow-hidden rounded-2xl py-0">
              <CardHeader className="gap-1 border-b bg-muted/30 py-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-violet-600" />
                  Campaign summary
                </CardTitle>
                <CardDescription>
                  Review your settings before submitting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 py-5 text-base">
                {advertiseTargets.length > 0 ? (
                  <SummaryRow
                    icon={Globe}
                    label="Advertising"
                    value={advertiseTargets
                      .map((target) =>
                        target === "social_media"
                          ? "Social media"
                          : target === "app"
                            ? "App"
                            : "Website"
                      )
                      .join(", ")}
                  />
                ) : null}
                <SummaryRow
                  icon={FileText}
                  label="Name"
                  value={campaignName || "Untitled campaign"}
                />
                <SummaryRow
                  icon={Layers}
                  label="Ad unit"
                  value={
                    adFormat
                      ? (AD_FORMATS.find((f) => f.value === adFormat)?.label ??
                        adFormat)
                      : "Not selected"
                  }
                />
                <SummaryRow
                  icon={Tag}
                  label="Pricing type"
                  value={pricingModel ?? "CPM"}
                />
                <SummaryRow
                  icon={Wallet}
                  label="Total budget"
                  value={
                    budgetUnlimited
                      ? "Unlimited"
                      : `$${Number(totalBudget || 0).toFixed(2)}`
                  }
                />
                {!budgetUnlimited ? (
                  <>
                    <SummaryRow
                      icon={Coins}
                      label="Daily budget"
                      value={`$${Number(dailyBudget || 0).toFixed(2)}`}
                    />
                    <SummaryRow
                      icon={CircleDollarSign}
                      label="Max CPC"
                      value={`$${Number(maxCpc || 0).toFixed(2)}`}
                    />
                  </>
                ) : null}
                <SummaryRow
                  icon={MapPin}
                  label="Countries"
                  value={
                    targetCountries.length > 0
                      ? `${targetCountries.length} selected`
                      : "None selected"
                  }
                />
                <SummaryRow
                  icon={Clock}
                  label="Start"
                  value={
                    START_MODES.find((m) => m.value === startMode)?.label ??
                    startMode ??
                    "Start once verified"
                  }
                />

                <div className="mt-2 flex items-start gap-2.5 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3.5">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-fuchsia-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      You&apos;re almost there!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Just a few more steps to launch your campaign.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2 border-t bg-muted/30 py-5">
                {isLastStep ? (
                  <Button
                    type="submit"
                    className="w-full brand-gradient rounded-full text-white"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting
                      ? "Submitting..."
                      : "Proceed to review"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full brand-gradient rounded-full text-white"
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
          ) : null}
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
          ? "tile-select text-foreground"
          : "border-border text-foreground tile-select-hover"
      )}
    >
      {selected ? (
        <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-black text-white">
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
  rate,
  selected,
  onClick,
}: {
  icon: React.ElementType
  label: string
  sublabel?: string
  description?: string
  badge?: string
  rate?: { cpm: number; cpa: number; cpc: number }
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex min-h-[190px] flex-col items-start gap-3 rounded-lg border p-5 text-left transition-colors",
        selected ? "tile-shade" : "border-border tile-hover"
      )}
    >
      {badge || selected ? (
        <div className="absolute right-4 top-4 flex items-center gap-1.5">
          {badge ? (
            <Badge className="border-transparent bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/20 dark:text-violet-300">
              {badge}
            </Badge>
          ) : null}
          {selected ? (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
          ) : null}
        </div>
      ) : null}
      <Icon className="size-6 text-foreground" />
      <div>
        <p className="text-base font-semibold text-foreground">
          {label}
          {sublabel ? (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              {sublabel}
            </span>
          ) : null}
        </p>
        {description ? (
          <p className="mt-1 text-sm text-foreground">{description}</p>
        ) : null}
      </div>
      {rate ? (
        <p className="mt-auto text-xs text-muted-foreground">
          From{" "}
          <span className="font-semibold text-foreground">
            ${rate.cpm.toFixed(2)}
          </span>{" "}
          CPM · ${rate.cpa.toFixed(2)} CPA · ${rate.cpc.toFixed(2)} CPC
        </p>
      ) : null}
    </button>
  )
}

// Plain option box - same hover/border/selected treatment as the other
// pickers in this wizard (see .tile-select / .tile-select-hover in
// globals.css), no icon.
function StartModeCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
        selected ? "tile-select" : "border-border tile-select-hover"
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-black text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  )
}

function PricingCard({
  icon: Icon,
  label,
  description,
  price,
  selected,
  onClick,
}: {
  icon: React.ElementType
  label: string
  description: string
  price?: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-orange-400 bg-orange-500/5"
          : "border-border hover:border-orange-300 hover:bg-orange-500/5"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          selected
            ? "brand-gradient text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </span>
      <div>
        <p
          className={cn(
            "text-base font-semibold",
            selected ? "text-orange-600" : "text-foreground"
          )}
        >
          {label}
        </p>
        <p className="text-sm text-foreground">{description}</p>
      </div>
      {price !== undefined ? (
        <p
          className={cn(
            "ml-auto shrink-0 text-base font-semibold",
            selected ? "text-orange-600" : "text-foreground"
          )}
        >
          ${price.toFixed(2)}
        </p>
      ) : null}
    </button>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-foreground">
        {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
        {label}
      </span>
      <span className="max-w-[60%] truncate text-right font-semibold">
        {value}
      </span>
    </div>
  )
}
