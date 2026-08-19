"use client"

import Link from "next/link"
import {
  AppWindow,
  ArrowRight,
  Clock,
  Film,
  Gamepad2,
  Gauge,
  Globe2,
  LineChart,
  Layers,
  ListChecks,
  Maximize,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AudienceTabs } from "@/components/app/audience-tabs"

// All copy on this page is written for AdsBender and describes how
// Interstitial ads generically work — it is not sourced or paraphrased from
// any competitor's marketing pages, and figures used are illustrative
// rather than reported network stats.
const VERTICALS = [
  {
    icon: AppWindow,
    title: "Apps",
    description:
      "A full-screen moment between app steps is a natural spot to promote an install.",
  },
  {
    icon: Gamepad2,
    title: "Games",
    description:
      "Level transitions and loading screens double as high-attention ad breaks.",
  },
  {
    icon: TrendingUp,
    title: "iGaming & Sports",
    description:
      "A full-screen placement gives time-sensitive betting and casino offers room to land.",
  },
  {
    icon: Wrench,
    title: "VPN & Utility",
    description:
      "A brief, unmissable moment works well for software that needs a clear pitch.",
  },
]

const WHY_ADVERTISERS: { icon: typeof TrendingUp; title: string; description: string }[] = [
  {
    icon: Maximize,
    title: "High visibility",
    description:
      "A full-screen placement is hard to miss, which tends to translate into stronger completion rates.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first reach",
    description:
      "Interstitial performs especially well on mobile, where screen space is already limited.",
  },
  {
    icon: Film,
    title: "Creative flexibility",
    description:
      "Run image, HTML5, or video creative depending on what the offer needs.",
  },
  {
    icon: Gauge,
    title: "Efficient bidding",
    description:
      "Automated bidding tools help you get the most from every dollar without babysitting your campaigns.",
  },
]

const WHY_PUBLISHERS: { icon: typeof TrendingUp; title: string; description: string }[] = [
  {
    icon: Wallet,
    title: "Premium rates",
    description:
      "Full-screen placements tend to command some of the higher CPMs on the network.",
  },
  {
    icon: Clock,
    title: "Minimal placements needed",
    description:
      "A single well-placed Interstitial can outperform several smaller units.",
  },
  {
    icon: Layers,
    title: "Clean re-engagement points",
    description:
      "Works naturally at loading screens or level transitions, without interrupting active reading.",
  },
  {
    icon: Sparkles,
    title: "Reliable fill",
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

export default function InterstitialAdsPage() {
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
              Interstitial Ads
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Full-Screen Placements That Command Attention
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              Run CPM or CPA Interstitial campaigns timed to natural
              transition points — or add an Interstitial unit to your site
              and turn high-attention moments into revenue.
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

          {/* PLACEHOLDER — replace with a real product screenshot/image. */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rotate-2 rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl shadow-orange-900/10">
              <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-card">
                <div className="flex size-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  <Maximize className="size-6" />
                </div>
                <div className="h-2.5 w-2/3 rounded bg-muted" />
                <div className="h-2 w-1/2 rounded bg-muted" />
                <div className="mt-2 h-8 w-2/3 rounded-md bg-orange-500/90" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it behaves */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Timed to natural pauses in the experience
            </h2>
            <p className="mt-4 text-muted-foreground">
              An Interstitial takes over the screen at a transition point —
              between app screens, page loads, or game levels — rather than
              interrupting active reading or play.
            </p>
            <p className="mt-3 text-muted-foreground">
              That timing is what makes it one of the more attention-grabbing
              formats available, especially on mobile.
            </p>
          </div>
          <div className="order-1 flex justify-center lg:order-2">
            {/* PLACEHOLDER — replace with a real product screenshot/image. */}
            <div className="flex size-48 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl sm:size-56">
              <Smartphone className="size-20 text-white/90" />
            </div>
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Why Interstitial — tabbed */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Why run Interstitial with AdsBender
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
          Verticals that perform well with Interstitial
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
          The Interstitial toolkit for advertisers &amp; publishers
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
          <Globe2 className="size-8 text-orange-500" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to try Interstitial?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Whichever side of the network you&apos;re on, it takes minutes to
            get your first campaign or ad zone live.
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
