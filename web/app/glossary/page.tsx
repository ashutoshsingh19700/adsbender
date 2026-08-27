import type { Metadata } from "next"
import Link from "next/link"

import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { definedTermSetJsonLd, jsonLdScriptProps } from "@/lib/seo"

// Industry-standard ad-tech definitions — not AdsBender-specific claims.
// Deliberately excludes RTB/OpenRTB: the footer's "RTB Traffic" link was
// removed rather than wired up because no RTB implementation exists on
// this platform (see site-footer.tsx), and defining the term here right
// next to formats/models AdsBender does support would read as an implicit
// claim that it's offered too.
type GlossaryTerm = {
  term: string
  definition: string
  linkHref?: string
  linkLabel?: string
}

const TERMS: GlossaryTerm[] = [
  {
    term: "Ad Network",
    definition:
      "A platform that sits between advertisers who want to buy traffic and publishers who want to sell it, matching campaigns to ad zones and handling delivery, pricing, and payouts.",
    linkHref: "/about",
    linkLabel: "How AdsBender works",
  },
  {
    term: "Ad Zone",
    definition:
      "A publisher's designated slot for serving ads — created in one of the network's supported formats, then reviewed and approved before it starts serving live traffic.",
    linkHref: "/publishers/benefits",
    linkLabel: "Set up an ad zone",
  },
  {
    term: "Conversion Flow",
    definition:
      "The sequence of steps a visitor takes from clicking an ad to completing the advertiser's goal — anything from a one-tap install to a multi-field signup form. Flow complexity is a major factor in choosing a pricing model.",
    linkHref: "/blog/cpa-cpc-cpm-decision-framework",
    linkLabel: "How flow complexity affects pricing",
  },
  {
    term: "CPA (Cost Per Action)",
    definition:
      "A pricing model where the advertiser pays only when a specific action completes — an install, a lead, a signup. Highest cost per unit, lowest risk to the advertiser.",
    linkHref: "/pricing-models",
    linkLabel: "Compare pricing models",
  },
  {
    term: "CPC (Cost Per Click)",
    definition:
      "A pricing model where the advertiser pays per click, regardless of what happens after. A middle ground between CPM and CPA on both cost and risk.",
    linkHref: "/pricing-models",
    linkLabel: "Compare pricing models",
  },
  {
    term: "CPM (Cost Per Mille)",
    definition:
      "A pricing model where the advertiser pays per thousand impressions, regardless of clicks or conversions. Lowest cost per unit, most useful for testing a new offer or GEO.",
    linkHref: "/pricing-models",
    linkLabel: "Compare pricing models",
  },
  {
    term: "CTR (Click-Through Rate)",
    definition:
      "The percentage of impressions that result in a click — a core signal for how well a creative and ad format fit the traffic they're shown to.",
  },
  {
    term: "eCPM (Effective CPM)",
    definition:
      "A publisher-side metric: total ad revenue divided by total impressions, multiplied by 1,000. Used to compare earnings across ad formats and pricing models on a common basis, even when the underlying traffic was sold on CPC or CPA.",
  },
  {
    term: "Fill Rate",
    definition:
      "The percentage of ad requests from a publisher's zone that were actually filled with an ad, rather than returning nothing.",
  },
  {
    term: "GEO",
    definition:
      "Shorthand for the geographic location (country or region) traffic originates from — a primary targeting dimension for advertisers and a major factor in the payout rates publishers see.",
  },
  {
    term: "Impression",
    definition:
      "One instance of an ad being displayed to a visitor, whether or not it's clicked. The basic unit CPM pricing is billed on.",
  },
  {
    term: "In-Page Push",
    definition:
      "An ad format that renders a native-style notification directly in page content, rather than through the browser's permission-gated push system — no opt-in step required from the visitor.",
    linkHref: "/ad-formats/in-page-push",
    linkLabel: "See the In-Page Push format",
  },
  {
    term: "Interstitial",
    definition:
      "A full-screen ad format that fires at a natural transition point — between pages, after an action, or on session start — rather than sharing the screen with other content.",
    linkHref: "/ad-formats/interstitial",
    linkLabel: "See the Interstitial format",
  },
  {
    term: "Popunder",
    definition:
      "An ad format that opens a new window behind the visitor's active page, so it's seen once they finish their current session rather than interrupting it.",
    linkHref: "/ad-formats/popunder",
    linkLabel: "See the Popunder format",
  },
  {
    term: "Social Bar",
    definition:
      "A non-intrusive on-page toolbar ad format that runs alongside a site's content without occupying dedicated ad space.",
    linkHref: "/ad-formats/social-bar",
    linkLabel: "See the Social Bar format",
  },
]

const TITLE = "Ad Tech Glossary"
const DESCRIPTION =
  "Plain-language definitions of the pricing models, ad formats, and metrics used across the AdsBender network."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/glossary" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/glossary" },
}

export default function GlossaryPage() {
  const sortedTerms = [...TERMS].sort((a, b) => a.term.localeCompare(b.term))

  return (
    <div>
      <script
        {...jsonLdScriptProps(
          definedTermSetJsonLd({ name: TITLE, path: "/glossary", terms: sortedTerms }),
        )}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Glossary", path: "/glossary" }]} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            Glossary
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Ad tech terms, explained
          </h1>
          <p className="mt-5 text-muted-foreground">
            The pricing models, ad formats, and metrics referenced across
            the site, defined in one place.
          </p>
        </div>
      </section>

      {/* Terms */}
      <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
        <dl className="flex flex-col divide-y rounded-2xl border bg-card">
          {sortedTerms.map((item) => (
            <div key={item.term} className="p-5">
              <dt className="font-medium">{item.term}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                {item.definition}
              </dd>
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
        </dl>
      </section>
    </div>
  )
}
