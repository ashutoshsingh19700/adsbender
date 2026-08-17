"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Check, CheckCircle2, Clock, Code2, Copy, Globe2, LayoutGrid } from "lucide-react"

import { ApiError, createAdZone, validateDomain } from "@/lib/api"
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
import { AdZoneManager } from "@/app/publisher/ad-zone-manager"
import { PublisherOverview } from "@/app/publisher/publisher-overview"
import { LAYOUT_TYPES, zoneSchema } from "@/app/publisher/zone-form"

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
  // Bumped after a zone is created so <AdZoneManager> re-fetches its list.
  const [zoneListVersion, setZoneListVersion] = React.useState(0)

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
          description={
            <>
              We check for a verification token at{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                https://your-domain.com/ads.txt
              </code>
              .
            </>
          }
        />
        <Form {...domainForm}>
          <form onSubmit={domainForm.handleSubmit(onValidateDomain)}>
            <CardContent className="space-y-4">
              <FormField
                control={domainForm.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <FormControl>
                      <Input placeholder="example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={domainForm.control}
                name="expectedText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected verification text (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="adnetwork-verify=..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave blank to use the default token for your account.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
