"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Check, CheckCircle2, Clock, Code2, Copy, Globe2, LayoutGrid } from "lucide-react"

import { ApiError, createAdZone, getPublisherProfile, validateDomain } from "@/lib/api"
import type { AdZone, PublisherSite } from "@/lib/types"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdZoneManager } from "@/app/publisher/ad-zone-manager"
import { PublisherOverview } from "@/app/publisher/publisher-overview"
import { LAYOUT_TYPES, zoneSchema } from "@/app/publisher/zone-form"

// Plain-language, per-platform steps for pasting the verification line onto
// a site's ads.txt — most publishers aren't developers and don't know what
// "root of your domain" means, so we point at the specific dashboard screen
// for the platforms publishers actually use.
const ADS_TXT_GUIDES: {
  value: string
  label: string
  steps: (token: string) => React.ReactNode[]
}[] = [
  {
    value: "wordpress",
    label: "WordPress",
    steps: (token) => [
      <>Log in to your host's control panel (cPanel, Hostinger, Bluehost, SiteGround, etc.) and open <b>File Manager</b>.</>,
      <>Open the <code className="rounded bg-muted px-1 py-0.5 text-xs">public_html</code> folder — this is your site's root.</>,
      <>Create a new file named exactly <code className="rounded bg-muted px-1 py-0.5 text-xs">ads.txt</code> (if one already exists, open it instead).</>,
      <>Add this line on its own, then save: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{token}</code></>,
    ],
  },
  {
    value: "wix",
    label: "Wix",
    steps: (token) => [
      <>In your Wix dashboard, go to <b>Marketing &amp; SEO → SEO Tools</b>.</>,
      <>Look for the <b>ads.txt</b> editor (Wix supports this natively for ad networks).</>,
      <>Paste this line into the box and save: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{token}</code></>,
    ],
  },
  {
    value: "shopify",
    label: "Shopify",
    steps: () => [
      <>Shopify doesn't expose a plain ads.txt editor — you'll need a small theme edit.</>,
      <>Search the Shopify App Store for a free "ads.txt" app, or ask whoever built your theme to add it for you.</>,
      <>If you'd rather do it yourself, our support team can walk you through the <code className="rounded bg-muted px-1 py-0.5 text-xs">templates/ads.txt.liquid</code> approach — just reach out.</>,
    ],
  },
  {
    value: "hosting",
    label: "GoDaddy / cPanel",
    steps: (token) => [
      <>Log in to your hosting account and open <b>File Manager</b> (in GoDaddy, this is under "Web Hosting → Manage → File Manager").</>,
      <>Go to the root folder of your site (often <code className="rounded bg-muted px-1 py-0.5 text-xs">public_html</code>).</>,
      <>Create or open a file named <code className="rounded bg-muted px-1 py-0.5 text-xs">ads.txt</code>.</>,
      <>Add this line and save: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{token}</code></>,
    ],
  },
  {
    value: "developer",
    label: "I have a developer",
    steps: (token) => [
      <>Send them this line and ask them to make it reachable at <code className="rounded bg-muted px-1 py-0.5 text-xs">https://your-domain.com/ads.txt</code>:</>,
      <><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{token}</code></>,
      <>If a file already exists there, this line just needs to be added anywhere in it — nothing else should be removed.</>,
    ],
  },
]

const domainSchema = z.object({
  domain: z.string().min(3, "Enter a domain, e.g. example.com"),
  expectedText: z.string().optional(),
})

// Numbered step header shared by the three onboarding cards below — mirrors
// the "account setup checklist" pattern AdSense uses, so it's obvious at a
// glance which step you're on and what's left.
function StepHeader({
  step,
  icon: Icon,
  title,
  description,
  done = false,
}: {
  step: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: React.ReactNode
  done?: boolean
}) {
  return (
    <CardHeader className="flex-row items-start gap-3.5 space-y-0">
      <div
        className={
          "relative flex size-10 shrink-0 items-center justify-center rounded-full " +
          (done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-orange-100 text-orange-600")
        }
      >
        {done ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
        <span className="absolute -top-1 -right-1 flex size-4.5 items-center justify-center rounded-full border-2 border-background bg-foreground text-[10px] font-semibold text-background">
          {step}
        </span>
      </div>
      <div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </CardHeader>
  )
}

// Live scaled-down preview of the slot dimensions being entered — the kind
// of immediate visual feedback AdSense gives when you're sizing an ad unit,
// so a publisher can sanity-check "leaderboard" vs "square" before saving.
const PREVIEW_MAX = 160

function ZonePreview({ width, height }: { width: number; height: number }) {
  const hasSize = width > 0 && height > 0
  const scale = hasSize ? Math.min(PREVIEW_MAX / width, PREVIEW_MAX / height, 1) : 1

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-lg border bg-muted/30 p-4 sm:w-40">
      <p className="text-xs font-medium text-muted-foreground">Preview</p>
      <div
        className="flex shrink-0 items-center justify-center rounded-md border-2 border-dashed border-orange-300 bg-orange-50 text-[10px] font-medium text-orange-500"
        style={{
          width: hasSize ? Math.max(width * scale, 32) : 96,
          height: hasSize ? Math.max(height * scale, 24) : 60,
        }}
      >
        AD
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {hasSize ? `${width} × ${height}px` : "Enter a size"}
      </p>
    </div>
  )
}

export function PublisherDashboard() {
  const [site, setSite] = React.useState<PublisherSite | null>(null)
  const [zone, setZone] = React.useState<{
    zone: AdZone
    snippet: string
  } | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [tokenCopied, setTokenCopied] = React.useState(false)
  const [publisherId, setPublisherId] = React.useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  // Bumped after a zone is created so <AdZoneManager> re-fetches its list.
  const [zoneListVersion, setZoneListVersion] = React.useState(0)

  // Needed so we can show the publisher their default ads.txt token below —
  // otherwise there's no way to know what to put in ads.txt without reading
  // backend source.
  React.useEffect(() => {
    let cancelled = false
    getPublisherProfile()
      .then((profile) => {
        if (!cancelled) setPublisherId(profile.id)
      })
      .catch(() => {
        // Non-critical: the form still works without this, just don't block on it.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const defaultToken = publisherId ? `adnetwork-verify=${publisherId}` : null

  async function copyToken() {
    if (!defaultToken) return
    await navigator.clipboard.writeText(defaultToken)
    setTokenCopied(true)
    setTimeout(() => setTokenCopied(false), 2000)
  }

  const domainForm = useForm<z.infer<typeof domainSchema>>({
    resolver: zodResolver(domainSchema),
    defaultValues: { domain: "", expectedText: "" },
  })

  const zoneForm = useForm<
    z.input<typeof zoneSchema>,
    unknown,
    z.output<typeof zoneSchema>
  >({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      zoneName: "",
      width: 300,
      height: 250,
      layoutType: "banner",
    },
  })

  async function onValidateDomain(values: z.infer<typeof domainSchema>) {
    try {
      const result = await validateDomain({
        domain: values.domain,
        expectedText: values.expectedText || undefined,
      })
      setSite(result)
      setZoneListVersion((v) => v + 1)
      toast.success(`${result.domain} verified`)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Domain validation failed"
      )
    }
  }

  async function onCreateZone(values: z.infer<typeof zoneSchema>) {
    try {
      const result = await createAdZone(values)
      setZone(result)
      setZoneListVersion((v) => v + 1)
      toast.success(`Ad zone "${result.zone.zoneName}" created`)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not create ad zone"
      )
    }
  }

  async function copySnippet() {
    if (!zone) return
    await navigator.clipboard.writeText(zone.snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Publisher Portal
        </h1>
        <p className="text-muted-foreground">
          Verify your site ownership and create ad zones to embed on your
          pages.
        </p>
      </div>

      <PublisherOverview refreshToken={zoneListVersion} />

      <Card>
        <StepHeader
          step={1}
          icon={Globe2}
          title="Verify domain ownership"
          done={!!site?.verified}
          description="We need one small proof that you own this website — no coding required, just a few clicks in your hosting dashboard. Prefer to skip this? Create your ad zone below and paste its snippet on your site — we'll verify it automatically the first time an ad loads there."
        />
        <Form {...domainForm}>
          <form onSubmit={domainForm.handleSubmit(onValidateDomain)}>
            <CardContent className="space-y-5">
              <FormField
                control={domainForm.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your website address</FormLabel>
                    <FormControl>
                      <Input placeholder="example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium">Your verification code</p>
                <p className="text-xs text-muted-foreground">
                  This is unique to your account. You&apos;ll paste it onto your
                  site in the next step.
                </p>
                {defaultToken ? (
                  <div className="flex items-center gap-2.5">
                    <code className="flex-1 truncate rounded bg-muted px-1.5 py-1 text-xs">
                      {defaultToken}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={copyToken}
                    >
                      {tokenCopied ? (
                        <>
                          <Check className="size-3.5" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" /> Copy code
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading your code…</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  How do I add this to my site?
                </p>
                <p className="text-xs text-muted-foreground">
                  Pick how your website is built for step-by-step instructions.
                </p>
                <Tabs defaultValue={ADS_TXT_GUIDES[0].value}>
                  <TabsList className="h-auto flex-wrap">
                    {ADS_TXT_GUIDES.map((guide) => (
                      <TabsTrigger key={guide.value} value={guide.value}>
                        {guide.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {ADS_TXT_GUIDES.map((guide) => (
                    <TabsContent key={guide.value} value={guide.value}>
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-foreground">
                        {guide.steps(defaultToken ?? "adnetwork-verify=…").map(
                          (step, i) => (
                            <li key={i}>{step}</li>
                          )
                        )}
                      </ol>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {showAdvanced ? (
                <FormField
                  control={domainForm.control}
                  name="expectedText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom verification code (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="adnetwork-verify=..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Only needed if you'd rather use your own code instead
                        of the one above.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setShowAdvanced(true)}
                >
                  I want to use my own custom code instead
                </button>
              )}

              {site ? (
                <div
                  className={
                    "flex items-center gap-2.5 rounded-md border p-3 text-sm " +
                    (site.verified
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50")
                  }
                >
                  {site.verified ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Clock className="size-4 shrink-0 text-amber-600" />
                  )}
                  <span className="font-medium">{site.domain}</span>
                  <Badge
                    variant="outline"
                    className={
                      site.verified
                        ? "ml-auto border-emerald-300 text-emerald-700"
                        : "ml-auto border-amber-300 text-amber-700"
                    }
                  >
                    {site.verified ? "Verified" : "Pending"}
                  </Badge>
                </div>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={domainForm.formState.isSubmitting}
              >
                {domainForm.formState.isSubmitting
                  ? "Verifying..."
                  : "Verify domain"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <StepHeader
          step={2}
          icon={LayoutGrid}
          title="Create an ad zone"
          description="Define a slot size and layout to generate an embeddable snippet."
        />
        <Form {...zoneForm}>
          <form onSubmit={zoneForm.handleSubmit(onCreateZone)}>
            <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={zoneForm.control}
                name="zoneName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Zone name</FormLabel>
                    <FormControl>
                      <Input placeholder="Homepage leaderboard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={zoneForm.control}
                name="width"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Width (px)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={(field.value as number | string) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={zoneForm.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (px)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={(field.value as number | string) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={zoneForm.control}
                name="layoutType"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Layout type</FormLabel>
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
                        {LAYOUT_TYPES.map((layout) => (
                          <SelectItem key={layout.value} value={layout.value}>
                            {layout.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>

              <ZonePreview
                width={Number(zoneForm.watch("width")) || 0}
                height={Number(zoneForm.watch("height")) || 0}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={zoneForm.formState.isSubmitting}>
                {zoneForm.formState.isSubmitting
                  ? "Creating..."
                  : "Create ad zone"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {zone ? (
        <Card>
          <StepHeader
            step={3}
            icon={Code2}
            title="Install on your site"
            description="Paste this snippet where the ad should appear on your page."
          />
          <CardContent>
            <Textarea readOnly rows={4} value={zone.snippet} className="font-mono text-xs" />
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={copySnippet}>
              {copied ? (
                <>
                  <Check className="size-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy snippet
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <div>
        <h2 className="text-xl font-semibold tracking-tight">My Ad Zones</h2>
        <p className="text-muted-foreground">
          Manage, edit, and inspect performance for every zone you&apos;ve
          created.
        </p>
      </div>
      <AdZoneManager refreshToken={zoneListVersion} />
    </div>
  )
}
