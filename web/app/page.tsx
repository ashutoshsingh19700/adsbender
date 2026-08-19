"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BarChart3,
  Clock,
  Gift,
  Globe2,
  LineChart,
  Megaphone,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import { ROLE_HOME } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const FEATURES = [
  {
    icon: Globe2,
    title: "Publisher onboarding",
    description:
      "Verify domain ownership via ads.txt and generate embeddable ad zone snippets in minutes.",
    href: "/publisher",
    cta: "Open Publisher Portal",
  },
  {
    icon: Megaphone,
    title: "Advertiser campaigns",
    description:
      "Set budgets, targeting, and creatives, then submit campaigns for review from one dashboard.",
    href: "/advertiser",
    cta: "Open Advertiser Studio",
  },
  {
    icon: LineChart,
    title: "Analytics",
    description:
      "Track impressions, clicks, CTR, spend, and payout across any date range, in real time.",
    href: "/analytics",
    cta: "Open Analytics",
  },
]

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Low-latency serving",
    description: "An ad engine built to pick and deliver the right creative without slowing pages down.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent by design",
    description: "Publishers and advertisers see the same impression, click, and spend data — no black box.",
  },
  {
    icon: Wallet,
    title: "Built-in payouts",
    description: "Wallet balances, spend tracking, and payouts live alongside your campaigns and ad units.",
  },
]

const PERKS = [
  {
    icon: BarChart3,
    title: "Higher Ad Revenue",
    description: "Boost earnings with smarter monetization",
  },
  {
    icon: Sparkles,
    title: "AI Optimization",
    description: "AI that works 24/7 to maximize your revenue",
  },
  {
    icon: ShieldCheck,
    title: "You're in Control",
    description: "Full transparency and complete control",
  },
]

const TRUSTED_BY = ["boAt", "Libas", "caffeine", "PLIX", "BIRKENSTOCK", "THE MAN COMPANY"]

const STEPS = [
  {
    step: "01",
    title: "Create an account",
    description: "Sign up as a publisher to monetize traffic, or as an advertiser to reach it.",
  },
  {
    step: "02",
    title: "Set up your side",
    description: "Publishers verify a domain and add ad units. Advertisers set a budget, targeting, and creatives.",
  },
  {
    step: "03",
    title: "Go live and track it",
    description: "The ad engine starts matching inventory to campaigns while analytics track everything.",
  },
]

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Signed-in users never see the public marketing page — no wallet,
  // earnings, or campaign data lives at "/" for anyone to land on. They're
  // sent straight to the dashboard for their role instead.
  React.useEffect(() => {
    if (!loading && user) {
      router.replace(ROLE_HOME[user.role])
    }
  }, [loading, user, router])

  if (loading || user) {
    return (
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] space-y-4 px-4 sm:px-6 lg:px-8 py-16">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Promo bar */}
      <div className="bg-neutral-950 px-4 py-3 text-sm text-neutral-50">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center">
          <span className="flex size-6 items-center justify-center rounded-full border border-neutral-700">
            <Gift className="size-3.5 text-orange-400" />
          </span>
          <span>Spend $500 on Ads in the next 60 days and get</span>
          <span className="rounded-md bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white">
            $150 FREE Ad Credit
          </span>
          <span>to boost your campaigns!</span>
          <Separator orientation="vertical" className="hidden h-4 bg-neutral-700 sm:block" />
          <span className="inline-flex items-center gap-1.5 text-neutral-400">
            <Clock className="size-3.5" />
            Offer valid for 60 days
          </span>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-medium text-orange-400 hover:text-orange-300"
          >
            View Details
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-orange-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-orange-200/50 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-40 left-0 -z-10 size-72 rounded-full bg-orange-100/60 blur-3xl"
        />
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: copy */}
            <div>
              <Badge className="gap-1.5 border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-100">
                <Sparkles className="size-3" />
                Built for Marketers. Designed for Performance.
              </Badge>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                You create content.
                <br />
                We help you
                <br />
                <span className="text-orange-500">earn more.</span>
              </h1>
              <p className="mt-5 max-w-md text-lg text-muted-foreground">
                Whether you&apos;re a creator, publisher or a global brand,
                AdsBender makes monetization simple, powerful and 100% in
                your control.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  <Link href="/login">
                    Get Started Now
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/analytics">
                    See How It Works
                    <PlayCircle />
                  </Link>
                </Button>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {PERKS.map((perk) => (
                  <div key={perk.title} className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                      <perk.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{perk.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {perk.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: dashboard mockup */}
            <div className="relative">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl shadow-orange-900/10">
                <div className="overflow-hidden rounded-lg bg-card">
                  <div className="flex border-b">
                    <div className="hidden w-32 shrink-0 border-r p-3 sm:block">
                      <div className="flex items-center gap-1.5 px-1 font-semibold text-xs">
                        <span className="flex size-4 items-center justify-center rounded bg-orange-500 text-[9px] font-bold text-white">
                          A
                        </span>
                        AdsBender
                      </div>
                      <ul className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                        {["Overview", "Campaigns", "Ad Units", "Reports", "Audience", "Payments", "Settings"].map(
                          (item, i) => (
                            <li
                              key={item}
                              className={
                                i === 0
                                  ? "rounded bg-orange-100 px-2 py-1 font-medium text-orange-700"
                                  : "px-2 py-1"
                              }
                            >
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                    <div className="flex-1 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Overview</p>
                        <span className="rounded-md border px-2 py-0.5 text-[10px] text-muted-foreground">
                          This Month
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { label: "Estimated Revenue", value: "$12,540", delta: "+32.6%" },
                          { label: "Impressions", value: "7.6M", delta: "+18.7%" },
                          { label: "Clicks", value: "432K", delta: "+21.4%" },
                          { label: "RPM", value: "$3.25", delta: "+15.6%" },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-lg border p-2">
                            <p className="text-[10px] text-muted-foreground">
                              {stat.label}
                            </p>
                            <p className="mt-0.5 text-sm font-semibold">
                              {stat.value}
                            </p>
                            <p className="text-[10px] font-medium text-emerald-600">
                              {stat.delta}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 p-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3 sm:col-span-2">
                      <p className="text-[10px] text-muted-foreground">
                        Revenue Overview
                      </p>
                      <svg viewBox="0 0 300 70" className="mt-2 h-16 w-full">
                        <polyline
                          fill="none"
                          stroke="var(--color-orange-500)"
                          strokeOpacity="0.85"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points="0,55 40,50 80,53 120,35 160,40 200,15 240,24 300,8"
                        />
                      </svg>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        Top Ad Platforms
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="size-12 shrink-0 rounded-full"
                          style={{
                            background:
                              "conic-gradient(var(--color-orange-500) 0 45%, var(--color-neutral-800) 45% 70%, var(--color-neutral-400) 70% 85%, var(--color-neutral-200) 85% 100%)",
                          }}
                        />
                        <ul className="space-y-0.5 text-[9px] text-muted-foreground">
                          <li>Google AdX 45%</li>
                          <li>Media.net 25%</li>
                          <li>Amazon Ads 15%</li>
                          <li>Others 15%</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating AI optimization card */}
              <div className="absolute -bottom-8 -left-6 hidden w-52 rounded-xl border bg-card p-3 shadow-xl ring-1 ring-foreground/10 sm:block">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">AI Optimization</p>
                  <Badge className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-700 hover:bg-emerald-100">
                    Active
                  </Badge>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Potential Revenue Increase
                </p>
                <p className="text-base font-semibold text-orange-500">
                  + $2,450{" "}
                  <span className="text-xs font-medium text-emerald-600">
                    (+28%)
                  </span>
                </p>
                <svg viewBox="0 0 200 40" className="mt-1 h-8 w-full">
                  <polyline
                    fill="none"
                    stroke="var(--color-orange-500)"
                    strokeOpacity="0.85"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,32 40,28 80,25 120,15 160,10 200,4"
                  />
                </svg>
                <Button size="sm" variant="outline" className="mt-2 w-full text-[10px]">
                  Apply All Recommendations
                </Button>
              </div>
            </div>
          </div>

          {/* Trusted by */}
          <div className="mt-24 text-center">
            <p className="text-sm text-muted-foreground">
              Trusted by 15,000+ creators, publishers &amp; brands worldwide
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70 grayscale">
              {TRUSTED_BY.map((name) => (
                <span
                  key={name}
                  className="text-lg font-semibold tracking-tight text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="text-center sm:text-left">
              <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 sm:mx-0">
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

      {/* Features */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything the platform runs on
          </h2>
          <p className="mt-3 text-muted-foreground">
            Each surface is built for the role that uses it — but they all
            share the same data.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.href} className="justify-between">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <feature.icon className="size-4.5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={feature.href}>
                    {feature.cta}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* How it works */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Live in three steps
          </h2>
        </div>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((item) => (
            <div key={item.step}>
              <span className="text-sm font-medium text-orange-500">
                {item.step}
              </span>
              <h3 className="mt-2 font-medium">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t bg-orange-50/60">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-col items-center gap-6 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <BarChart3 className="size-8 text-orange-500" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to see it running?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Create an account and set up your publisher or advertiser profile
            — the dashboard is ready as soon as you are.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            <Link href="/login">
              Get started
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
