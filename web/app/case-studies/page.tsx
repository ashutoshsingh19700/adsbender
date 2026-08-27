import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Clock, MonitorSmartphone, TrendingUp, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Breadcrumbs } from "@/components/app/breadcrumbs"

// TODO(seo): every entry below is a placeholder shape, not a real customer
// result — there's no campaign data behind this project to report yet (see
// the SEO report's decision to keep this structural-only, and the same
// "demo network" comment on site-footer.tsx). Do not fill these in with
// invented numbers; replace each with a real vertical/format/pricing model/
// timeline/result once a real campaign is available to write up, then lift
// the noindex below and add "/case-studies" to sitemap.ts.
const CASE_STUDIES = [
  {
    vertical: "iGaming & Sports",
    format: "Popunder",
    pricingModel: "CPM",
    goal: "Test a new GEO on a fast-moving betting offer",
  },
  {
    vertical: "VPN & Utility Software",
    format: "In-Page Push",
    pricingModel: "CPA",
    goal: "Drive installs with a simple, well-understood conversion flow",
  },
  {
    vertical: "eCommerce",
    format: "Social Bar",
    pricingModel: "CPC",
    goal: "Move a seasonal promo without competing with on-site content",
  },
  {
    vertical: "Sweepstakes",
    format: "Interstitial",
    pricingModel: "CPA",
    goal: "Maximize signups at a high-attention transition point",
  },
]

const TITLE = "Case Studies"
const DESCRIPTION =
  "How advertisers use AdsBender's ad formats and pricing models across verticals — real campaign write-ups, published as they're available."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/case-studies" },
  // Every entry on this page is a placeholder shape, not a reportable
  // result yet (see the TODO above) — a search result promising case
  // studies shouldn't land on unfilled ones. Lift this once real write-ups
  // replace the placeholders.
  robots: { index: false, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/case-studies" },
}

export default function CaseStudiesPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Breadcrumbs
              items={[{ name: "Home", path: "/" }, { name: "Case Studies", path: "/case-studies" }]}
            />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            Case Studies
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Real campaigns, written up as they happen
          </h1>
          <p className="mt-5 text-muted-foreground">
            This page is being built out with real advertiser write-ups —
            vertical, ad format, pricing model, and the actual result. The
            shapes below show what&apos;s coming; none of them are published
            results yet.
          </p>
        </div>
      </section>

      {/* Placeholder grid */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {CASE_STUDIES.map((study) => (
            <div
              key={`${study.vertical}-${study.format}`}
              className="rounded-2xl border border-dashed bg-card p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{study.vertical}</p>
                <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  Coming soon
                </Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{study.goal}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-600">
                  <MonitorSmartphone className="size-3.5" />
                  {study.format}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-800">
                  <Wallet className="size-3.5" />
                  {study.pricingModel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="size-3.5" />
                  Result pending
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t bg-violet-50/60">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-col items-center gap-6 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Want to be the next case study?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Launch a campaign today, or explore the ad formats and pricing
            models above to see which fits your vertical.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:from-violet-700 hover:to-blue-600"
            >
              <Link href="/login?tab=register&role=ADVERTISER">
                Launch a campaign
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/services">
                Browse services
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
