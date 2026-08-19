import Link from "next/link"
import { ArrowRight, Lightbulb } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type PricingModel = {
  id: string
  name: string
  tagline: string
  description: string
  tip?: string
  verticals: string[]
  adFormats: string[]
  tone: "plain" | "muted"
}

const PRICING_MODELS: PricingModel[] = [
  {
    id: "cpa",
    name: "CPA",
    tagline: "Cost per action",
    description:
      "Cost-per-action is the safest and the most expensive pricing model. Choose it when you know your customers well and when the conversion flow is simple (e.g., app installs). If you target a new audience or have a complex conversion flow (e.g., CC submits), start with the CPM model instead.",
    tip: "Use CPA pricing for CPL (cost-per-lead), CPI (cost-per-install), and PIN Submit conversion flows.",
    verticals: [
      "VPN/Utility - Install, trial",
      "Addons - Install",
      "Dating - Signups",
      "Carrier Billing - 1-2 click, click2sms",
      "Sweeps - Signups",
      "E-commerce - Installs",
    ],
    adFormats: ["Popunder", "Social Bar", "In-Page Push", "Interstitial"],
    tone: "muted",
  },
  {
    id: "cpc",
    name: "CPC",
    tagline: "Cost per click",
    description:
      "Choose the cost-per-click payment when you set clicks as the primary KPI or when you're confident the offer will convert easily after users reach the landing page. Ensure your lander is ready to convert visitors. Otherwise, the highest CTRs won't lead to numerous conversions.",
    verticals: ["E-commerce - all flows", "Sports - all flows", "iGaming - all flows", "Carrier Billing - 1-2 click"],
    adFormats: ["Social Bar", "In-Page Push"],
    tone: "plain",
  },
  {
    id: "cpm",
    name: "CPM",
    tagline: "Cost per thousand",
    description:
      "The cost-per-thousand pricing is great for discovering new GEOs and testing traffic. All complex conversion flows, such as CC submits & deposits, are better to be tested with the CPM model. This approach is budget-friendly and enables you to distribute your money effectively.",
    verticals: ["E-commerce - all flows", "Sports - all flows", "iGaming - all flows", "Carrier Billing - 1-2 click"],
    adFormats: ["Popunder", "Social Bar", "In-Page Push", "Interstitial"],
    tone: "muted",
  },
]

export default function PricingModelsPage() {
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
              AdsBender Pricing
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Get Premium-Quality Traffic With Full Spending Transparency
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              With AdsBender&apos;s pricing models, you can target wisely and
              optimize your advertising budgets while accessing top traffic
              sources for your offers. Stay safe from overspending with our
              robust bidding and optimization tools.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Link href="/login?tab=register">
                Run Campaign
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="relative mx-auto flex h-64 w-full max-w-sm items-center justify-center sm:h-72">
            <div className="absolute size-52 rotate-6 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl sm:size-60" />
            <span className="absolute top-6 left-2 -rotate-6 rounded-xl bg-neutral-900 px-5 py-3 text-lg font-bold text-white shadow-lg sm:text-xl">
              CPM
            </span>
            <span className="absolute bottom-8 left-8 rotate-3 rounded-xl bg-white px-5 py-3 text-lg font-bold text-orange-600 shadow-lg ring-1 ring-orange-200 sm:text-xl">
              CPA
            </span>
            <span className="absolute right-2 bottom-2 -rotate-3 rounded-xl bg-neutral-900 px-5 py-3 text-lg font-bold text-white shadow-lg sm:text-xl">
              CPC
            </span>
          </div>
        </div>
      </section>

      {/* Section heading */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Which <span className="text-orange-500">AdsBender pricing model</span>{" "}
          fits your vertical best?
        </h2>
      </section>

      {/* Model breakdown */}
      <section>
        {PRICING_MODELS.map((model) => (
          <div
            key={model.id}
            className={model.tone === "muted" ? "bg-muted/50" : "bg-background"}
          >
            <div className="mx-auto grid max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] gap-8 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div>
                <p className="text-2xl font-bold text-orange-500">{model.name}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {model.tagline}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-foreground/90">
                  {model.description}
                </p>
                {model.tip && (
                  <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-orange-500" />
                    {model.tip}
                  </p>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Verticals:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {model.verticals.map((vertical) => (
                      <span
                        key={vertical}
                        className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-800"
                      >
                        {vertical}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Ad formats:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {model.adFormats.map((format) => (
                      <span
                        key={format}
                        className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <Separator className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]" />

      {/* CTA band */}
      <section className="border-t bg-orange-50/60">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-col items-center gap-6 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to launch a campaign?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Pick the pricing model that matches your vertical and start
            buying traffic in minutes.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            <Link href="/login?tab=register">
              Get started
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
