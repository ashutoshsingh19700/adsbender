import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Bell,
  Layers,
  LineChart,
  MonitorSmartphone,
  RectangleHorizontal,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { jsonLdScriptProps, serviceJsonLd } from "@/lib/seo"

// The pillar page for the ad-formats topic cluster (see the SEO report —
// each format page's breadcrumb previously dead-ended at Home because this
// hub didn't exist). Every service listed here already has its own page;
// this page's job is purely to tie them together for crawlers and readers,
// not to duplicate their content.
const AD_FORMATS = [
  {
    icon: MonitorSmartphone,
    title: "Popunder Ads",
    description:
      "High-volume traffic that opens behind the active window — CPM or CPA, built for apps, iGaming, software, and eCommerce offers.",
    href: "/ad-formats/popunder",
  },
  {
    icon: Layers,
    title: "Social Bar Ads",
    description:
      "A non-intrusive on-page toolbar that runs CPM, CPC, or CPA without competing with the rest of the site.",
    href: "/ad-formats/social-bar",
  },
  {
    icon: Bell,
    title: "In-Page Push Ads",
    description:
      "Native-style notifications placed directly in page content — no opt-in required, works across every GEO and device.",
    href: "/ad-formats/in-page-push",
  },
  {
    icon: RectangleHorizontal,
    title: "Interstitial Ads",
    description:
      "Full-screen placements timed to natural transition points, for campaigns that need maximum attention per impression.",
    href: "/ad-formats/interstitial",
  },
]

const OTHER_SERVICES = [
  {
    icon: Wallet,
    title: "Pricing Models",
    description:
      "CPA, CPC, or CPM — compare how each is priced, which verticals it fits, and which ad formats support it.",
    href: "/pricing-models",
  },
  {
    icon: LineChart,
    title: "Publisher Monetization",
    description:
      "Turn site traffic into revenue with reviewed ad zones and fair, transparent payouts across every format above.",
    href: "/publishers/benefits",
  },
]

const TITLE = "Services — Ad Formats, Pricing & Publisher Monetization"
const DESCRIPTION =
  "Everything AdsBender offers in one place: four ad formats for advertisers, three transparent pricing models, and a monetization platform for publishers."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/services" },
}

export default function ServicesPage() {
  return (
    <div>
      {[...AD_FORMATS, ...OTHER_SERVICES].map((service) => (
        <script
          key={service.href}
          {...jsonLdScriptProps(
            serviceJsonLd({
              name: service.title,
              description: service.description,
              path: service.href,
            }),
          )}
        />
      ))}

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            AdsBender Services
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Four ad formats. Three pricing models. One dashboard.
          </h1>
          <p className="mt-5 text-muted-foreground">
            Whether you&apos;re buying traffic or monetizing it, everything
            runs through the same network — pick a format below to see how
            it works.
          </p>
        </div>
      </section>

      {/* Ad formats */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ad formats
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Available on every pricing model below, with targeting by country,
          device, and traffic type.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AD_FORMATS.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className="group flex flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-violet-300"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <service.icon className="size-5" />
              </div>
              <p className="mt-4 font-medium">{service.title}</p>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {service.description}
              </p>
              {/* <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600">
                Learn more
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span> */}
            </Link>
          ))}
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Pricing + monetization */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Pricing &amp; monetization
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {OTHER_SERVICES.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className="group flex flex-col rounded-2xl border bg-card p-8 transition-colors hover:border-violet-300"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <service.icon className="size-5" />
              </div>
              <p className="mt-4 text-lg font-semibold">{service.title}</p>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {service.description}
              </p>
              {/* <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600">
                Learn more
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span> */}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t bg-violet-50/60">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-col items-center gap-6 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Sign up as an advertiser to launch a campaign, or as a publisher
            to start monetizing your traffic.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="btn-shine brand-gradient rounded-full px-6 text-white"
            >
              <Link href="/login?tab=register&role=ADVERTISER">
                Launch a campaign
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login?tab=register&role=PUBLISHER">
                Monetize my site
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
