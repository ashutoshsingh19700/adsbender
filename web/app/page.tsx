"use client"

import * as React from "react"
import Image from "next/image"
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
  Wallet,
  Zap,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import { ROLE_HOME } from "@/lib/roles"
import { Button } from "@/components/ui/button"
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
      <section className="relative overflow-hidden bg-background">
        <div className="mx-auto max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1760px] px-4 sm:px-6 lg:px-8 pt-6 pb-16 sm:pt-8 sm:pb-20">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-6 xl:gap-10">
            {/* Left: copy */}
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                One platform.
                <br />
                All your campaigns.
                <br />
                <span className="text-orange-500">Better results.</span>
              </h1>
              <p className="mt-6 max-w-md text-lg text-foreground/80 sm:text-xl">
                Launch, manage and optimize high-performing ad campaigns
                across multiple platforms — from one powerful dashboard.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <span className="btn-halo">
                  <Button
                    asChild
                    size="lg"
                    className="btn-shine rounded-full bg-orange-500 px-6 text-white hover:bg-orange-600"
                  >
                    <Link href="/login">
                      Get Started Now
                      <ArrowRight />
                    </Link>
                  </Button>
                </span>
                <span className="btn-halo">
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="btn-shine btn-shine-tint rounded-full border-orange-300 px-6 text-orange-600 hover:bg-white hover:text-orange-600"
                  >
                    <Link href="/analytics">
                      See How It Works
                      <PlayCircle />
                    </Link>
                  </Button>
                </span>
              </div>
            </div>

            {/* Right: product screenshot */}
            <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
              <div className="overflow-hidden rounded-2xl">
                <Image
                  src="/hero/hero-dashboard.png"
                  alt="AdsBender analytics dashboard showing spend, impressions, clicks and campaign performance"
                  width={1536}
                  height={1017}
                  priority
                  className="h-auto w-full [mask-image:linear-gradient(to_bottom,black_82%,transparent)]"
                />
              </div>
            </div>
          </div>

          {/* Trusted by */}
          <div className="mt-24 text-center">
            <p className="text-sm text-muted-foreground">
              Trusted by 15,000+ creators, publishers &amp; brands worldwide
            </p>
            <div className="mt-6 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] overflow-hidden">
              <div className="animate-marquee flex w-max items-center gap-x-16">
                {[...TRUSTED_BY, ...TRUSTED_BY].map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="shrink-0 text-lg font-semibold tracking-tight text-muted-foreground opacity-70 grayscale"
                  >
                    {name}
                  </span>
                ))}
              </div>
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
