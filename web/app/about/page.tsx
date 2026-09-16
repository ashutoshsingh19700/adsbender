import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Gauge, Globe2, ShieldCheck, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { aboutPageJsonLd, jsonLdScriptProps } from "@/lib/seo"

// Product/mission copy only — no team bios, founding date, headcount, or
// office address. None of that exists as a verified fact for this site
// (see site-footer.tsx's own comment: "this is a demo network, not a
// registered company"), and a claim like "founded in 2021" or "trusted by
// 10,000 advertisers" would be exactly the kind of fabricated E-E-A-T
// signal that damages trust once anyone checks it. Every statement below
// is a capability claim ("supports these formats/models"), not a track
// record claim.
const TITLE = "About"
const DESCRIPTION =
  "AdsBender is a two-sided ad network connecting advertisers who want performance-driven traffic with publishers who want fair, transparent payouts."

const PRINCIPLES = [
  {
    icon: Gauge,
    title: "Spending transparency",
    description:
      "Every campaign runs on one of three plain pricing models — CPA, CPC, or CPM — so advertisers always know exactly what a result costs.",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed inventory",
    description:
      "Publisher ad zones go through approval before they can serve traffic, and campaigns go through review before they go live.",
  },
  {
    icon: Globe2,
    title: "Global reach",
    description:
      "Traffic and demand run across every GEO, device, and OS — the same four ad formats work whether a campaign is local or worldwide.",
  },
  {
    icon: Zap,
    title: "Fast to start",
    description:
      "Sign up, pick a pricing model or ad zone, and a first campaign or placement can be live the same day — no lengthy onboarding queue.",
  },
]

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/about" },
}

export default function AboutPage() {
  return (
    <div>
      <script {...jsonLdScriptProps(aboutPageJsonLd({ path: "/about", description: DESCRIPTION }))} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }]} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            About AdsBender
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            One network, two sides of the same trade
          </h1>
          <p className="mt-5 font-medium text-foreground/75">
            AdsBender connects advertisers who need performance-driven
            traffic with publishers who need a reliable way to monetize
            their sites — through the same four ad formats, the same
            transparent pricing models, and one dashboard for both sides.
          </p>
        </div>
      </section>

      {/* What we do */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-8">
            <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
              For advertisers
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              Launch campaigns across Popunder, Social Bar, In-Page Push,
              and Interstitial traffic
            </h2>
            <p className="mt-4 text-sm font-medium text-foreground/75">
              Pick a pricing model that matches how confident you are in the
              offer — CPM to test a new GEO or a complex conversion flow,
              CPC when clicks are the KPI, CPA when the flow is simple and
              well understood — then target by country, device, and traffic
              type.
            </p>
            <Button asChild variant="link" className="mt-4 px-0 text-violet-600">
              <Link href="/pricing-models">
                Compare pricing models
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-8">
            <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
              For publishers
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              Monetize traffic without disrupting the site experience
            </h2>
            <p className="mt-4 text-sm font-medium text-foreground/75">
              Add an ad zone in one of the four formats, wait for approval,
              and start collecting payouts — Social Bar and In-Page Push run
              alongside existing ad units without the opt-in friction that
              limits browser push notifications.
            </p>
            <Button asChild variant="link" className="mt-4 px-0 text-violet-600">
              <Link href="/publishers/benefits">
                See publisher benefits
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Principles */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          How AdsBender works
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} className="rounded-2xl border bg-card p-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <principle.icon className="size-5" />
              </div>
              <p className="mt-4 font-medium">{principle.title}</p>
              <p className="mt-2 text-sm font-medium text-foreground/75">
                {principle.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t bg-violet-50/60">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-col items-center gap-6 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Questions before you start?
          </h2>
          <p className="max-w-md font-medium text-foreground/75">
            Reach out and the team will help you find the right ad format or
            pricing model for your traffic.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:from-violet-700 hover:to-blue-600"
            >
              <Link href="/contact">
                Contact us
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login?tab=register">Get started</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
