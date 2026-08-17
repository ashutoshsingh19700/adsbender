import Link from "next/link"
import { ArrowRight, Bell, Layers, LogIn, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

// Copy on this page is written for AdsBender and describes how In-Page Push
// generically works — it isn't sourced or paraphrased from any competitor's
// marketing pages, and it doesn't cite specific traffic or revenue figures.
//
// PLACEHOLDER GRAPHICS: the boxed mockups below stand in for real product
// screenshots. Swap them for actual images once they're provided — each is
// marked with a comment so they're easy to find.
const ADVERTISER_STEPS = [
  { title: "Sign up or log in as an advertiser." },
  { title: "Head to the campaign builder." },
  { title: "Pick a pricing model and select In-Page Push as the ad unit." },
  { title: "Set your targeting — country, device, and traffic type." },
  { title: "Upload creatives and submit your campaign for review." },
]

const PUBLISHER_STEPS = [
  { title: "Sign up or log in as a publisher." },
  { title: "Open your ad zones and add a new one." },
  { title: "Fill in your site details and choose In-Page Push as the format." },
  { title: "Wait for zone approval, then grab your code snippet." },
  { title: "Place the snippet on your site and start earning." },
]

function MockCard({ className = "" }: { className?: string }) {
  // PLACEHOLDER — replace with a real screenshot/image.
  return (
    <div className={`rounded-xl border border-neutral-800 bg-neutral-900 p-4 ${className}`}>
      <div className="rounded-lg bg-card p-3">
        <div className="flex items-center gap-3 rounded-md border p-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-600">
            <Bell className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2 w-3/4 rounded bg-muted" />
            <div className="h-2 w-1/2 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-3 rounded-md border p-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-orange-600">
            <Layers className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2 w-2/3 rounded bg-muted" />
            <div className="h-2 w-1/3 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InPagePushAdsPage() {
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
              In-Page Push Ads
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Native-Style Notifications That Earn Their Click
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              Run CPM, CPC, or CPA campaigns on In-Page Push traffic as an
              advertiser — or monetize every impression on your site as a
              publisher, without needing users to opt in first.
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
                  Monetize Now
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>

          {/* PLACEHOLDER — replace with a real product screenshot/image. */}
          <div className="relative mx-auto w-full max-w-sm">
            <MockCard className="rotate-3 shadow-2xl shadow-orange-900/10" />
            <div className="absolute -bottom-5 -left-5 -rotate-6 rounded-lg border bg-card p-2 shadow-xl">
              <div className="w-40 space-y-1.5 p-1">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-2/3 rounded bg-muted" />
                <div className="mt-2 h-8 rounded-md bg-orange-500/90" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          {/* PLACEHOLDER — replace with a real product screenshot/image. */}
          <MockCard />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How do In-Page Push ads work?
            </h2>
            <p className="mt-4 text-muted-foreground">
              In-Page Push places a native-style notification directly in the
              page content, which tends to make it more visible than a
              typical browser push message. It works across every GEO,
              device, browser, and OS.
            </p>
            <p className="mt-4">
              <span className="font-medium text-orange-600">
                For advertisers:
              </span>{" "}
              <span className="text-muted-foreground">
                steady CPM, CPC, and CPA traffic with engagement that holds
                up well across verticals.
              </span>
            </p>
            <p className="mt-3">
              <span className="font-medium text-orange-600">
                For publishers:
              </span>{" "}
              <span className="text-muted-foreground">
                an extra revenue layer that stacks cleanly alongside your
                other ad formats, without the opt-in friction that increasingly
                limits browser push notifications.
              </span>
            </p>
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl" />

      {/* How to run — advertisers */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          How to run In-Page Push ads?
        </h2>
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          {/* PLACEHOLDER — replace with a real product screenshot/image. */}
          <MockCard />
          <div>
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-orange-600">
              <UserPlus className="size-5" />
              For Advertisers
            </div>
            <ol className="space-y-4">
              {ADVERTISER_STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm">{step.title}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* How to run — publishers */}
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
          {/* PLACEHOLDER — replace with a real product screenshot/image. */}
          <MockCard />
          <div>
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-orange-600">
              <LogIn className="size-5" />
              For Publishers
            </div>
            <ol className="space-y-4">
              {PUBLISHER_STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm">{step.title}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t bg-orange-50/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center">
          <Bell className="size-8 text-orange-500" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to try In-Page Push?
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
                Monetize Now
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
