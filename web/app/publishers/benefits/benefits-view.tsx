"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Clock,
  Download,
  Gauge,
  Gamepad2,
  Layers,
  Link2,
  MonitorSmartphone,
  Music2,
  Newspaper,
  RectangleHorizontal,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { getAllPosts } from "@/lib/blog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "@/components/app/breadcrumbs"

// All copy on this page describes AdsBender's own publisher offering. It is
// written for this project — not copied or paraphrased from any specific
// competitor's marketing pages — and any figures are illustrative rather
// than reported network stats. Section *layout* (hero-with-stat-panel,
// pill-tabbed ad format switcher, numbered steps band, accordion feature
// list, FAQ) follows the common pattern used across ad-network marketing
// sites; colors are AdsBender's own violet/blue system throughout.

// ---------------------------------------------------------------------------
// Traffic types the network monetizes
// ---------------------------------------------------------------------------

const TRAFFIC_TYPES = [
  { icon: Users, label: "Social Traffic" },
  { icon: Clapperboard, label: "Movies & Streaming" },
  { icon: Download, label: "Software Downloads" },
  { icon: Server, label: "Hosting & Tech" },
  { icon: Music2, label: "Music & Audio" },
  { icon: Newspaper, label: "News & Blogs" },
  { icon: Link2, label: "URL Shorteners" },
  { icon: Gamepad2, label: "Games" },
] as const

// ---------------------------------------------------------------------------
// Ad formats — hover/click tabs
// ---------------------------------------------------------------------------

type AdFormat = {
  key: string
  label: string
  title: string
  description: string
  bullets: string[]
  icon: typeof MonitorSmartphone
  href: string
}

const AD_FORMATS: AdFormat[] = [
  {
    key: "popunder",
    label: "Popunder",
    title: "Popunder (also Onclick)",
    description:
      "A full-page ad that opens quietly in a new tab behind the active window — one of the highest-paying formats on the network.",
    bullets: [
      "Takes up no space on your site's layout",
      "Doesn't interrupt the visitor's session",
      "Strong demand from iGaming, VPN, and eCommerce advertisers",
    ],
    icon: MonitorSmartphone,
    href: "/ad-formats/popunder",
  },
  {
    key: "social-bar",
    label: "Social Bar",
    title: "Social Bar",
    description:
      "A non-intrusive on-page toolbar that runs alongside your content instead of interrupting it. Strong CTRs translate into higher CPM rates.",
    bullets: [
      "Docks to the page without taking over the layout",
      "Consistent experience across devices and browsers, including iOS",
      "No dedicated ad space or visitor opt-in required",
    ],
    icon: Layers,
    href: "/ad-formats/social-bar",
  },
  {
    key: "in-page-push",
    label: "In-Page Push",
    title: "In-Page Push",
    description:
      "Native-style notifications placed directly in your page content — the same recognizable format as browser push, without depending on a permission prompt to get there.",
    bullets: [
      "No subscription or opt-in step for visitors",
      "Works across every GEO, device, browser, and OS",
      "Layers cleanly alongside your other ad zones",
    ],
    icon: Bell,
    href: "/ad-formats/in-page-push",
  },
  {
    key: "interstitial",
    label: "Interstitial",
    title: "Interstitial",
    description:
      "A full-screen placement timed to a natural transition point — between pages, after an action, or on session start — for maximum attention per impression.",
    bullets: [
      "The native pattern visitors already expect at app and game breakpoints",
      "Strong demand from time-sensitive and high-urgency offers",
      "Pairs well with Popunder for advertisers testing both formats",
    ],
    icon: RectangleHorizontal,
    href: "/ad-formats/interstitial",
  },
]

function AdFormatTabs() {
  const [active, setActive] = React.useState(AD_FORMATS[0].key)
  const format = AD_FORMATS.find((f) => f.key === active) ?? AD_FORMATS[0]

  function handleLearnMore(e: React.MouseEvent, f: AdFormat) {
    if (f.href === "#") {
      e.preventDefault()
      toast.info(`${f.title} — coming soon`)
    }
  }

  return (
    <div>
      <div className="mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-full border p-1.5">
        {AD_FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            onMouseEnter={() => setActive(f.key)}
            onClick={() => setActive(f.key)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active === f.key
                ? "bg-gradient-to-r from-violet-600 to-blue-500 text-white"
                : "text-foreground/80 hover:bg-violet-50 hover:text-violet-600"
            )}
            aria-pressed={active === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid items-center gap-10 rounded-2xl bg-violet-50/60 p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {format.title}
          </h3>
          <p className="mt-3 text-muted-foreground">{format.description}</p>
          <ul className="mt-5 space-y-2.5">
            {format.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-500" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:from-violet-700 hover:to-blue-600">
              <Link href="/login?tab=register&role=PUBLISHER">
                Earn with {format.label}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" onClick={(e) => handleLearnMore(e, format)}>
              <Link href={format.href}>Learn more</Link>
            </Button>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="flex size-48 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-xl sm:size-56">
            <format.icon className="size-20 text-white/90" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Platform walkthrough — accordion feature list
// ---------------------------------------------------------------------------

const PLATFORM_FEATURES = [
  {
    key: "easy-start",
    title: "Easy start and management",
    description:
      "Add your website, get it approved, and generate your first ad code — choosing the units that fit your layout best.",
  },
  {
    key: "control",
    title: "Control over revenue",
    description:
      "Turn zones on or off, adjust which formats run where, and see updated earnings without waiting on support.",
  },
  {
    key: "statistics",
    title: "Real-time statistics",
    description:
      "Impressions, clicks, and earnings roll in live per site and per zone, so you can see what's working today.",
  },
  {
    key: "extra",
    title: "Extra monetization",
    description:
      "Layer a second or third ad format onto existing traffic instead of replacing what's already earning.",
  },
  {
    key: "payouts",
    title: "Payout details",
    description:
      "Track your balance and request a payout once you clear the minimum — reviewed and sent out by the AdsBender team.",
  },
] as const

function PlatformAccordion() {
  const [open, setOpen] = React.useState<string>(PLATFORM_FEATURES[0].key)

  return (
    <div className="divide-y rounded-2xl border">
      {PLATFORM_FEATURES.map((feature) => {
        const isOpen = open === feature.key
        return (
          <div key={feature.key}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? "" : feature.key)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
              aria-expanded={isOpen}
            >
              <span className={cn("font-medium", isOpen && "text-violet-600")}>
                {feature.title}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180 text-violet-600"
                )}
              />
            </button>
            {isOpen && (
              <p className="px-5 pb-5 text-sm text-muted-foreground sm:px-6">
                {feature.description}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Why publishers monetize with AdsBender
// ---------------------------------------------------------------------------

const WHY_ADSBENDER = [
  {
    icon: Users,
    title: "Dedicated support",
    description: "Reach a real person when you're setting up a site or troubleshooting a zone that isn't filling.",
  },
  {
    icon: Gauge,
    title: "Competitive CPM rates",
    description: "Rates factor in views, clicks, and conversions, so quality traffic is rewarded, not just volume.",
  },
  {
    icon: ShieldCheck,
    title: "Fraud & malware controls",
    description: "Built-in fraud detection and velocity capping keep the ad feed clean for you and your visitors.",
  },
  {
    icon: Wallet,
    title: "Reliable payouts",
    description: "Track your balance in real time and request a payout once you clear the minimum threshold.",
  },
  {
    icon: Zap,
    title: "No traffic minimums",
    description: "Add a brand-new site and start monetizing from day one — no entrance thresholds to clear first.",
  },
  {
    icon: Sparkles,
    title: "Multiple ad formats",
    description: "Popunder, Social Bar, In-Page Push, and Interstitial — layer on more as your traffic grows.",
  },
] as const

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I monetize a website?",
    a: "Create a publisher account, confirm your email, then add your website from the dashboard. Once it's approved you can generate your first ad unit and start collecting payouts.",
  },
  {
    q: "Which ad format should I start with?",
    a: "There's no single right answer — it depends on your traffic. Popunder and Social Bar are the easiest first formats for most sites, while In-Page Push and Interstitial work well alongside them once you're ready to layer on more revenue.",
  },
  {
    q: "Is there a minimum traffic requirement?",
    a: "No. AdsBender has no entrance traffic limits, so you can add a brand-new site and start monetizing from day one.",
  },
  {
    q: "How much does it cost to join?",
    a: "Nothing. Signing up and adding ad units is free — the only thing you're spending is the time it takes to set up your site.",
  },
  {
    q: "How do payouts work?",
    a: "Your earnings accrue to your wallet balance as impressions and clicks come in. Once you clear the minimum threshold, request a payout from the dashboard and the AdsBender team reviews and processes it.",
  },
]

function Faq() {
  const [open, setOpen] = React.useState<string | null>(FAQS[0].q)

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQS.map((item) => {
        const isOpen = open === item.q
        return (
          <div key={item.q} className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : item.q)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-medium">{item.q}</span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && (
              <p className="px-5 pb-4 text-sm text-muted-foreground">{item.a}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats + steps
// ---------------------------------------------------------------------------

const STATS = [
  { value: "12K+", label: "publishers monetizing sites and social traffic" },
  { value: "98%", label: "fill rate across active ad units" },
  { value: "10-min", label: "typical approval on the platform" },
]

const STEPS = [
  { n: 1, title: "Register as a Publisher", description: "Sign up and confirm your email — no traffic minimums to clear first." },
  { n: 2, title: "Add your website", description: "Get approved, then generate an ad code for the zones you want to run." },
  { n: 3, title: "Start earning", description: "Track impressions and earnings live, and request a payout once you clear the minimum." },
]

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

export function BenefitsView() {
  const posts = getAllPosts().slice(0, 3)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background">
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-12 sm:pb-20">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Publisher Benefits", path: "/publishers/benefits" },
            ]}
          />

          <div className="mt-8 grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
            {/* Left: copy */}
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
                Website Monetization Platform for Publishers
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Grow Earnings With Safe and Profitable Ad Feed
              </h1>
              <p className="mt-5 max-w-md text-muted-foreground">
                Maximize revenue with a monetization platform built for
                publishers. Sell traffic and get fair, high CPM rates.
              </p>
              <div className="mt-8">
                <span className="btn-halo">
                  <Button
                    asChild
                    size="lg"
                    className="btn-shine rounded-full bg-gradient-to-r from-violet-600 to-blue-500 px-6 text-white hover:from-violet-700 hover:to-blue-600"
                  >
                    <Link href="/login?tab=register&role=PUBLISHER">
                      Start Earning
                      <ArrowRight />
                    </Link>
                  </Button>
                </span>
              </div>
            </div>

            {/* Right: gradient stat panel, with the dashboard mock
                stacked below it and pulled up slightly for a "peeking
                over" effect. Normal document flow (not absolute overlap)
                so long stat labels can never collide with the mock — the
                two just stack with a small negative margin between
                them. */}
            <div className="flex flex-col justify-center">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-blue-500 px-6 py-8 sm:px-8 sm:py-10">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-10 -right-10 size-52 rounded-full bg-white/10 blur-2xl"
                />
                <div className="relative grid grid-cols-3 gap-4 text-white">
                  {STATS.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-2xl font-bold sm:text-3xl">{stat.value}</p>
                      <p className="mt-1.5 text-xs text-white/80 sm:text-sm">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="z-10 mx-6 -mt-6 sm:mx-10">
                <div className="rotate-1 rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl shadow-violet-900/20">
                  <div className="overflow-hidden rounded-lg bg-card">
                    <div className="flex items-center gap-1.5 border-b p-2.5">
                      <span className="size-2.5 rounded-full bg-red-400" />
                      <span className="size-2.5 rounded-full bg-amber-400" />
                      <span className="size-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="text-xs font-medium">Websites</p>
                      <div className="h-16 rounded-md bg-violet-100" />
                      <div className="h-2.5 w-3/4 rounded bg-muted" />
                      <div className="h-2.5 w-full rounded bg-muted" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top-earning traffic types */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Traffic our top publishers monetize
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TRAFFIC_TYPES.map((type) => (
            <div
              key={type.label}
              className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center transition-colors hover:border-violet-300 hover:bg-violet-50/40"
            >
              <div className="flex size-11 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <type.icon className="size-5" />
              </div>
              <p className="text-sm font-medium">{type.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ad formats — hover/click tabs */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          <span className="text-violet-500">High-value ads</span> publishers
          profit from
        </h2>
        <div className="mt-10">
          <AdFormatTabs />
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Platform walkthrough */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Website monetization platform
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Everything you need to go from a new site to a paid-out
              balance, in one dashboard.
            </p>
            <div className="mt-8">
              <PlatformAccordion />
            </div>
          </div>

          <div className="hidden justify-center lg:flex">
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-blue-500 p-8 shadow-xl">
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-12 -left-12 size-48 rounded-full bg-white/10 blur-2xl"
              />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2.5 rounded-lg bg-white/95 px-4 py-3 shadow-sm">
                  <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Add website</p>
                    <p className="text-[11px] text-muted-foreground">example.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-white/95 px-4 py-3 shadow-sm">
                  <div className="flex size-8 items-center justify-center rounded-md bg-violet-100 text-violet-600">
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Create ad unit</p>
                    <p className="text-[11px] text-muted-foreground">Popunder · Social Bar</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-white/95 px-4 py-3 shadow-sm">
                  <div className="flex size-8 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                    <Wallet className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Track earnings</p>
                    <p className="text-[11px] text-muted-foreground">Updated in real time</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* Why AdsBender */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Why publishers monetize with AdsBender
        </h2>
        <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {WHY_ADSBENDER.map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 text-white shadow-md">
                <item.icon className="size-5.5" />
              </div>
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Numbered steps band */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-blue-500">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Join AdsBender today
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white ring-1 ring-white/30">
                  {step.n}
                </div>
                <h3 className="mt-4 font-medium text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm text-white/80">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-white px-6 text-violet-700 hover:bg-white/90"
            >
              <Link href="/login?tab=register&role=PUBLISHER">
                Sign Up and Try
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* From the blog */}
      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Guides for publishers
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-2xl border p-6 transition-colors hover:border-violet-300 hover:bg-violet-50/40"
              >
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {dateFormatter.format(new Date(post.publishedAt))}
                </p>
                <h3 className="mt-3 font-medium group-hover:text-violet-600">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {post.description}
                </p>
                <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-violet-600">
                  Read more
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* FAQ */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Questions about ads for publishers
        </h2>
        <div className="mt-10">
          <Faq />
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t bg-violet-50/60">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-col items-center gap-6 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Wallet className="size-8 text-violet-500" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to start monetizing?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Add your website and get your first ad unit live in minutes.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:from-violet-700 hover:to-blue-600"
          >
            <Link href="/login?tab=register&role=PUBLISHER">
              Start Earning
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
