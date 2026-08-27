"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Gauge,
  Layers,
  MonitorSmartphone,
  RectangleHorizontal,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "@/components/app/breadcrumbs"

// All copy on this page describes AdsBender's own publisher offering. It is
// written for this project — not copied or paraphrased from any specific
// competitor's marketing pages — and any figures are illustrative rather
// than reported network stats.

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
      <div className="flex flex-wrap justify-center gap-2">
        {AD_FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            onMouseEnter={() => setActive(f.key)}
            onClick={() => setActive(f.key)}
            className={cn(
              "rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
              active === f.key
                ? "border-violet-500 bg-violet-500 text-white"
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

const STATS = [
  { icon: Sparkles, value: "12K+", label: "publishers monetizing sites and social traffic" },
  { icon: Gauge, value: "98%", label: "fill rate across active ad units" },
  { icon: Clock, value: "10-min", label: "typical approval on the platform" },
]

const WHY_ADSBENDER = [
  {
    icon: Wallet,
    title: "Payouts you can rely on",
    description: "Track earnings in real time and withdraw through the payment method that works for you.",
  },
  {
    icon: ShieldCheck,
    title: "No traffic minimums",
    description: "Add a brand-new site and start monetizing from day one — no entrance thresholds.",
  },
  {
    icon: Gauge,
    title: "Smart ad rotation",
    description: "The highest-paying available demand is served automatically, zone by zone.",
  },
]

export function BenefitsView() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto grid max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] items-center gap-10 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Breadcrumbs
              items={[
                { name: "Home", path: "/" },
                { name: "Publisher Benefits", path: "/publishers/benefits" },
              ]}
            />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
              Website Monetization Platform for Publishers
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Grow Earnings With Safe and Profitable Ad Feed
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              Maximize revenue with a monetization platform built for
              publishers. Sell traffic and get fair, high CPM rates.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <stat.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="rotate-3 rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl shadow-violet-900/10">
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
                  <div className="h-2.5 w-5/6 rounded bg-muted" />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 -rotate-3 rounded-xl border bg-card p-2 shadow-xl">
              <div className="w-32 space-y-1.5 p-1">
                <p className="text-[10px] font-medium">Add website</p>
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-2/3 rounded bg-muted" />
                <div className="mt-2 h-10 rounded-md bg-violet-500/90" />
              </div>
            </div>
          </div>
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

      {/* Why AdsBender */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Why publishers monetize with AdsBender
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {WHY_ADSBENDER.map((item) => (
            <div key={item.title} className="text-center sm:text-left">
              <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 sm:mx-0">
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-medium">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

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
