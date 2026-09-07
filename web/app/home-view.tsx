"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, PlayCircle } from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import { ROLE_HOME } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const SIGNUP_OFFERS = [
  {
    id: "A",
    credit: "$100",
    spend: "$100",
  },
  {
    id: "B",
    credit: "$150",
    spend: "$500",
  },
  {
    id: "C",
    credit: "$300",
    spend: "$1,000",
  },
] as const

export function HomeView() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [selectedOffer, setSelectedOffer] = React.useState<(typeof SIGNUP_OFFERS)[number]["id"]>(
    SIGNUP_OFFERS[0].id,
  )

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
      {/* Hero */}
      <section className="relative overflow-hidden bg-background">
        <div className="mx-auto max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1760px] px-4 sm:px-6 lg:px-8 pt-6 pb-16 sm:pt-8 sm:pb-20">
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-6 xl:gap-10">
            {/* Left: product explainer — full-bleed, edges feathered into the
                page background rather than boxed in a card, so it reads as
                part of the page rather than a video embed. */}
            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <video
                src="/hero/hero-explainer.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                disablePictureInPicture
                disableRemotePlayback
                controlsList="nodownload nofullscreen noremoteplayback"
                aria-label="AdsBender product explainer: too many ad platforms, too much complexity, brought together into one dashboard for better results"
                className="h-auto w-full [mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent),linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in]"
              />
            </div>

            {/* Right: copy */}
            <div>
              {/* The explainer video already types out "One platform." /
                  "All your campaigns." as part of its story, so showing
                  those lines again here would just repeat it back-to-back.
                  They stay in the markup for SEO/screen readers (video text
                  isn't indexable or accessible) but are visually hidden;
                  "Better results." is the one line that isn't in the video,
                  so that's what's shown. */}
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                <span className="sr-only">One platform. All your campaigns. </span>
                <span className="brand-gradient bg-clip-text text-transparent">
                  Better results.
                </span>
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
                    className="btn-shine brand-gradient rounded-full px-6 text-white"
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
                    {/* Was "/analytics" — that route is gated by
                        proxy.ts and 307s signed-out visitors (and
                        crawlers) to /login: a dead end for both UX and
                        SEO (redirect chain into a noindexed page). */}
                    <Link href="/pricing-models">
                      See How It Works
                      <PlayCircle />
                    </Link>
                  </Button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sign-up offer */}
      <section className="bg-orange-50/40 border-y">
        <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Choose a sign-up offer to jumpstart your first campaign
            </h2>
            <p className="mt-3 text-muted-foreground">
              Select an offer that fits your monthly budget and sign up when
              ready. New advertisers receive ad credit after meeting the
              minimum spend requirement for the selected offer.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {SIGNUP_OFFERS.map((offer) => {
              const isSelected = offer.id === selectedOffer
              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setSelectedOffer(offer.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "group relative rounded-2xl border bg-background p-6 text-center transition-colors",
                    isSelected
                      ? "border-orange-500 ring-1 ring-orange-500"
                      : "border-border hover:border-orange-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute right-4 top-4 flex size-5 items-center justify-center rounded-full border-2",
                      isSelected
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {isSelected && <Check className="size-3" strokeWidth={3} />}
                  </span>

                  <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold tracking-wide text-orange-700 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                    OFFER {offer.id}
                  </span>
                  <p className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
                    {offer.credit}
                  </p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    in ad credit
                  </p>
                  <p className="mt-4 text-sm text-foreground/80">
                    Spend {offer.spend} with AdsBender in the first 60 days to
                    unlock the credit.
                  </p>
                </button>
              )
            })}
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row sm:text-left">
            <div>
              <p className="font-medium">How to claim your offer</p>
              <p className="text-sm text-muted-foreground">
                Sign up and complete payment setup to apply the offer to your
                account.
              </p>
            </div>
            <span className="btn-halo">
              <Button
                asChild
                size="lg"
                className="btn-shine brand-gradient rounded-full px-6 text-white"
              >
                <Link href="/login">
                  Claim now
                  <ArrowRight />
                </Link>
              </Button>
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
