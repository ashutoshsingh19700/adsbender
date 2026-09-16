import type { Metadata } from "next"
import Link from "next/link"

import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { faqJsonLd, jsonLdScriptProps, type FaqItem } from "@/lib/seo"

// Every answer below restates a fact already established elsewhere in the
// app (no ad zone minimum-traffic requirement, free to join, zones/
// campaigns go through approval, the four real ad formats) rather than
// inventing new claims — see app/publishers/benefits/benefits-view.tsx's
// own FAQ and app/about/page.tsx's principles for the source facts. Phrased
// freshly here, not copy-pasted, to avoid shipping duplicate content across
// two URLs.
type FaqSection = { heading: string; items: (FaqItem & { linkHref?: string; linkLabel?: string })[] }

const SECTIONS: FaqSection[] = [
  {
    heading: "General",
    items: [
      {
        question: "What is AdsBender?",
        answer:
          "AdsBender is a two-sided ad network: advertisers launch campaigns to buy traffic, and publishers add ad zones to monetize theirs. Both sides run through the same four ad formats and the same three pricing models.",
        linkHref: "/about",
        linkLabel: "Read more about AdsBender",
      },
      {
        question: "Which ad formats does AdsBender support?",
        answer:
          "Four: Popunder, Social Bar, In-Page Push, and Interstitial. Each is available to advertisers as a campaign target and to publishers as an ad zone type.",
        linkHref: "/services",
        linkLabel: "Compare all ad formats",
      },
    ],
  },
  {
    heading: "For advertisers",
    items: [
      {
        question: "How do I launch a campaign?",
        answer:
          "Sign up or log in as an advertiser, open the campaign builder, pick a pricing model and an ad format, set your targeting (country, device, traffic type), then upload creatives and submit the campaign for review.",
        linkHref: "/login?tab=register&role=ADVERTISER",
        linkLabel: "Get started as an advertiser",
      },
      {
        question: "Which pricing model should I use — CPA, CPC, or CPM?",
        answer:
          "It depends on how well-tested the offer already is: CPM for a new GEO or a complex, multi-step conversion flow; CPC once click-through and landing-page performance are proven; CPA once the whole funnel is validated and the flow is simple.",
        linkHref: "/blog/cpa-cpc-cpm-decision-framework",
        linkLabel: "Read the full decision framework",
      },
    ],
  },
  {
    heading: "For publishers",
    items: [
      {
        question: "How do I monetize my website?",
        answer:
          "Sign up or log in as a publisher, add your site, and create an ad zone in one of the four formats. Once the zone is approved you'll get a code snippet — place it on your site and payouts start accruing from live traffic.",
        linkHref: "/publishers/benefits",
        linkLabel: "See publisher benefits",
      },
      {
        question: "Is there a minimum traffic requirement to join?",
        answer:
          "No — there's no entrance traffic limit. A brand-new site can add an ad zone and start monetizing right away.",
      },
      {
        question: "How much does it cost to join as a publisher?",
        answer:
          "Nothing. Creating an account and adding ad zones is free; AdsBender only takes a share of the revenue an ad zone actually generates.",
      },
      {
        question: "Will adding an ad zone hurt my Core Web Vitals?",
        answer:
          "Not if it's wired in correctly — reserved space for the ad container, non-blocking script loading, and initialization that doesn't compete with user interactions are the three things that matter most.",
        linkHref: "/blog/ad-zone-core-web-vitals",
        linkLabel: "Read the full checklist",
      },
    ],
  },
  {
    heading: "Pricing",
    items: [
      {
        question: "What's the difference between CPA, CPC, and CPM?",
        answer:
          "CPM charges per thousand impressions, CPC per click, and CPA per completed action (install, lead, signup). Each shifts risk between advertiser and network differently — CPM is lowest cost with the least certainty, CPA is highest cost with the most.",
        linkHref: "/pricing-models",
        linkLabel: "Compare pricing models in depth",
      },
    ],
  },
]

const TITLE = "Frequently Asked Questions"
const DESCRIPTION =
  "Answers for advertisers and publishers on launching campaigns, monetizing traffic, ad formats, and pricing models on AdsBender."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/faq" },
}

export default function FaqPage() {
  const allItems = SECTIONS.flatMap((section) => section.items)

  return (
    <div>
      <script {...jsonLdScriptProps(faqJsonLd(allItems))} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            Frequently Asked Questions
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Answers for advertisers and publishers
          </h1>
        </div>
      </section>

      {/* Sections */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col gap-12">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <h2 className="text-xl font-semibold tracking-tight">
                {section.heading}
              </h2>
              <div className="mt-5 flex flex-col divide-y rounded-2xl border bg-card">
                {section.items.map((item) => (
                  <div key={item.question} className="p-5">
                    <p className="font-medium">{item.question}</p>
                    <p className="mt-2 text-sm font-medium text-foreground/75">
                      {item.answer}
                    </p>
                    {item.linkHref && (
                      <Link
                        href={item.linkHref}
                        className="mt-3 inline-block text-sm font-medium text-violet-600 hover:underline"
                      >
                        {item.linkLabel}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
