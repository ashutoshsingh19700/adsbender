"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Clock,
  Gamepad2,
  Gauge,
  Globe2,
  LineChart,
  Layers,
  ListChecks,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AudienceTabs } from "@/components/app/audience-tabs"

// All copy on this page is written for AdsBender and describes how the
// Popunder format behaves generically — it is not sourced or paraphrased
// from any specific competitor's marketing pages, and any figures are
// illustrative rather than reported network stats.
const VERTICALS = [
  {
    icon: Gamepad2,
    title: "Apps",
    description:
      "Drive installs and re-engagement with a format built around a single, unmissable action.",
  },
  {
    icon: TrendingUp,
    title: "iGaming & Sports",
    description:
      "Pair a full-page Popunder with a strong landing page to move fast-moving betting and casino offers.",
  },
  {
    icon: Wrench,
    title: "Software & Utilities",
    description:
      "Give VPNs, cleaners, and antivirus tools room to make their pitch before the visitor moves on.",
  },
  {
    icon: ShoppingCart,
    title: "eCommerce",
    description:
      "Surface a seasonal promo or cart reminder without competing with the page the visitor is already on.",
  },
]

const WHY_ADVERTISERS: { icon: typeof TrendingUp; title: string; description: string }[] = [
  {
    icon: TrendingUp,
    title: "Healthy ROI",
    description:
      "Popunder campaigns on AdsBender post return figures well above break-even across most of our top verticals.",
  },
  {
    icon: Gauge,
    title: "Smarter spend",
    description:
      "Automated bidding tools help you get more from every dollar without babysitting your campaigns.",
  },
  {
    icon: ListChecks,
    title: "Vetted offers",
    description:
      "Pull from a shortlist of offers our team has already seen convert well on this exact format.",
  },
  {
    icon: Globe2,
    title: "Broad reach",
    description:
      "Reach traffic across every major region without any extra setup on your end.",
  },
]

const WHY_PUBLISHERS: { icon: typeof TrendingUp; title: string; description: string }[] = [
  {
    icon: Wallet,
    title: "Dependable payouts",
    description:
      "Popunder is one of the most consistently monetized formats across the network.",
  },
  {
    icon: MonitorSmartphone,
    title: "Low friction",
    description:
      "The least disruptive full-page format for visitors — most sites won't need to run anything else alongside it.",
  },
  {
    icon: TrendingUp,
    title: "Strong-paying verticals",
    description:
      "Regularly pulls demand from Software, Sweepstakes, and iGaming advertisers.",
  },
  {
    icon: Sparkles,
    title: "High fill rate",
    description:
      "Rarely see unfilled impressions, whatever the season or GEO.",
  },
]

const TOOLKIT_ADVERTISERS = [
  {
    icon: Settings2,
    title: "Self-serve platform",
    description:
      "Launch campaigns, adjust bids, and fine-tune targeting from one control center.",
  },
  {
    icon: Gauge,
    title: "Budget & bid tools",
    description:
      "Automated bidding helps allocate spend efficiently as a campaign runs.",
  },
  {
    icon: LineChart,
    title: "Real-time auctions",
    description:
      "Traffic is priced through live auctions, so you're never overpaying for impressions.",
  },
  {
    icon: ListChecks,
    title: "Conversion tracking",
    description:
      "Hook up your tracker of choice and pull performance data through the API.",
  },
  {
    icon: Users,
    title: "Campaign guidance",
    description:
      "Get help structuring a new campaign from a team that watches this format daily.",
  },
  {
    icon: ShieldCheck,
    title: "Live partner support",
    description:
      "Reach a real person when a campaign needs a second look.",
  },
]

const TOOLKIT_PUBLISHERS = [
  {
    icon: Settings2,
    title: "Publisher dashboard",
    description:
      "Manage every ad zone, see live stats, and adjust settings without a ticket.",
  },
  {
    icon: LineChart,
    title: "Zone-level reporting",
    description:
      "Break earnings down by zone, country, and device to see what's actually working.",
  },
  {
    icon: Layers,
    title: "Smart ad rotation",
    description:
      "The highest-paying available demand is served automatically, zone by zone.",
  },
  {
    icon: Wallet,
    title: "Payment API",
    description:
      "Pull balance and payout data programmatically if you're managing multiple sites.",
  },
  {
    icon: Users,
    title: "Onboarding help",
    description:
      "New publishers get help getting their first zone approved and live.",
  },
  {
    icon: ShieldCheck,
    title: "Live chat support",
    description:
      "Ask questions about payouts, approval, or a zone that isn't filling as expected.",
  },
]

export default function PopunderAdsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-orange-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-orange-200/50 blur-3xl"
        />
        <div className="mx-auto grid max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] items-center gap-10 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold tracking-wide text-orange-500 uppercase">
              Popunder Ads
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Turn Popunder Traffic Into Predictable Revenue
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              Run CPM or CPA Popunder campaigns backed by a constantly
              growing base of publisher inventory — or add a Popunder zone to
              your site in minutes and start collecting payouts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <Link href="/login?tab=register&role=ADVERTISER">
                  Launch Campaign
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login?tab=register&role=PUBLISHER">
                  Start Earning
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <Image
              src="/ad-formats/popunder-hero.png"
              alt="A browser tab showing a website, with a Popunder ad from AdsBender opening quietly behind it"
              width={1528}
              height={1029}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </section>

      {/* How it behaves */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <Image
          src="/ad-formats/popunder-how-it-works.png"
          alt="How Popunder ads look for your visitors: 1. Visitor clicks on your site, 2. Popunder opens in the background, 3. Visitor discovers the ad later. High Visibility, Better Performance, Non-Intrusive, Consistent Payouts."
          width={1774}
          height={887}
          className="h-auto w-full"
        />
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Why Popunder — tabbed */}
      <section id="why-popunder" className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Why run Popunder with AdsBender
        </h2>
        <div className="mt-10 text-left">
          <AudienceTabs
            advertiserCards={WHY_ADVERTISERS}
            publisherCards={WHY_PUBLISHERS}
          />
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Verticals */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Verticals that perform well with Popunder
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VERTICALS.map((vertical) => (
            <div key={vertical.title} className="rounded-xl border p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <vertical.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-medium">{vertical.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {vertical.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
            <Link href="/login?tab=register&role=ADVERTISER">
              Launch Campaign
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login?tab=register&role=PUBLISHER">
              Start Earning
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Toolkit — tabbed */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          The Popunder toolkit for advertisers &amp; publishers
        </h2>
        <div className="mt-10 text-left">
          <AudienceTabs
            advertiserCards={TOOLKIT_ADVERTISERS}
            publisherCards={TOOLKIT_PUBLISHERS}
            columns={3}
          />
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t bg-orange-50/60">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-col items-center gap-6 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Clock className="size-8 text-orange-500" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to try Popunder?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Whichever side of the network you&apos;re on, it takes minutes to get
            your first campaign or ad zone live.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              <Link href="/login?tab=register&role=ADVERTISER">
                Launch Campaign
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login?tab=register&role=PUBLISHER">
                Start Earning
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
