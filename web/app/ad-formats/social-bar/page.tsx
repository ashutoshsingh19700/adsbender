"use client"

import Link from "next/link"
import {
  ArrowRight,
  Clock,
  Gauge,
  Globe2,
  Heart,
  LineChart,
  Layers,
  ListChecks,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AudienceTabs } from "@/components/app/audience-tabs"

// All copy on this page is written for AdsBender and describes how Social
// Bar generically works — it is not sourced or paraphrased from any
// competitor's marketing pages, and figures used are illustrative rather
// than reported network stats.
const VERTICALS = [
  {
    icon: Heart,
    title: "Dating",
    description:
      "A toolbar-style prompt gives dating offers room to make their pitch without covering the page.",
  },
  {
    icon: Sparkles,
    title: "Sweepstakes",
    description:
      "Reward and giveaway offers read naturally in a Social Bar's chat-style or notification subformats.",
  },
  {
    icon: Wrench,
    title: "Software & Utilities",
    description:
      "VPNs, cleaners, and security tools get a persistent, low-pressure spot to be noticed.",
  },
  {
    icon: TrendingUp,
    title: "iGaming & Sports",
    description:
      "A subtle, always-visible bar keeps time-sensitive betting and casino offers in view.",
  },
]

const WHY_ADVERTISERS: { icon: typeof TrendingUp; title: string; description: string }[] = [
  {
    icon: MessageSquare,
    title: "High engagement",
    description:
      "A toolbar draws attention without covering the page, so visitors interact with it instead of dismissing it outright.",
  },
  {
    icon: Layers,
    title: "Flexible creative styles",
    description:
      "Choose between OS-style, classic, or chat-style subformats to match the offer.",
  },
  {
    icon: Gauge,
    title: "Budget efficiency",
    description:
      "Automated bidding tools help you spend where the traffic is actually converting.",
  },
  {
    icon: Globe2,
    title: "Broad device reach",
    description:
      "Runs cleanly on both desktop and mobile without extra configuration.",
  },
]

const WHY_PUBLISHERS: { icon: typeof TrendingUp; title: string; description: string }[] = [
  {
    icon: Wallet,
    title: "Strong RPMs",
    description:
      "Social Bar is consistently one of the better-monetized formats on the network.",
  },
  {
    icon: Layers,
    title: "Stacks with other formats",
    description:
      "Runs cleanly alongside Popunder or In-Page Push without competing for the same space.",
  },
  {
    icon: Clock,
    title: "Fast approval",
    description:
      "Most new ad zones move from submission to live in a short review window.",
  },
  {
    icon: Sparkles,
    title: "Consistent fill",
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

export default function SocialBarAdsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-orange-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-orange-200/50 blur-3xl"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold tracking-wide text-orange-500 uppercase">
              Social Bar Ads
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              A Toolbar That Doesn&apos;t Feel Like An Ad
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              Run CPM, CPC, or CPA campaigns through Social Bar&apos;s on-page
              toolbar — or add it to your site as a lightweight, non-intrusive
              way to monetize every visitor.
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
              <div className="overflow-hidden rounded-lg bg-card">
                <div className="h-24 bg-orange-100" />
                <div className="space-y-2 p-3">
                  <div className="h-2.5 w-2/3 rounded bg-muted" />
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600">
                      <MessageSquare className="size-3.5" />
                    </div>
                    <div className="h-2 flex-1 rounded bg-muted" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 -rotate-3 rounded-xl border bg-card p-2 shadow-xl">
              <div className="w-32 space-y-1.5 p-1">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-2/3 rounded bg-muted" />
                <div className="mt-2 h-8 rounded-md bg-orange-500/90" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it behaves */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Built to blend into the page
            </h2>
            <p className="mt-4 text-muted-foreground">
              Social Bar sits as a slim, interactive strip rather than
              covering the content, with subformats ranging from OS-style
              alerts to chat-style prompts.
            </p>
            <p className="mt-3 text-muted-foreground">
              Because it doesn&apos;t block the page, it tends to stay visible and
              interactive far longer than a full-screen or pop-up format.
            </p>
          </div>
          <div className="order-1 flex justify-center lg:order-2">
            {/* PLACEHOLDER — replace with a real product screenshot/image. */}
            <div className="flex size-48 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl sm:size-56">
              <MessageSquare className="size-20 text-white/90" />
            </div>
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl" />

      {/* Why Social Bar — tabbed */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Why run Social Bar with AdsBender
        </h2>
        <div className="mt-10 text-left">
          <AudienceTabs
            advertiserCards={WHY_ADVERTISERS}
            publisherCards={WHY_PUBLISHERS}
          />
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl" />

      {/* Verticals */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Verticals that perform well with Social Bar
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

      <Separator className="mx-auto max-w-6xl" />

      {/* Toolkit — tabbed */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          The Social Bar toolkit for advertisers &amp; publishers
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
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center">
          <Sparkles className="size-8 text-orange-500" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to try Social Bar?
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
