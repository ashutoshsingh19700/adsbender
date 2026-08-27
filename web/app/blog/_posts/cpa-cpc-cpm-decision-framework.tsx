import Link from "next/link"

import type { BlogPostMeta } from "@/lib/blog"

export const meta: BlogPostMeta = {
  slug: "cpa-cpc-cpm-decision-framework",
  title: "CPA vs. CPC vs. CPM: A Decision Framework",
  description:
    "A practical way to choose between CPA, CPC, and CPM pricing based on how much you know about your offer — not just which one sounds cheapest.",
  category: "Pricing",
  publishedAt: "2026-08-10",
  readingTimeMinutes: 6,
}

export function CpaCpcCpmDecisionFramework() {
  return (
    <>
      <p>
        Most advertisers pick a pricing model by asking “which one is
        cheapest?” That’s the wrong first question. The right one is: how
        much do I already know about how this offer converts? Our{" "}
        <Link href="/pricing-models" className="text-violet-600 hover:underline">
          pricing models page
        </Link>{" "}
        covers what CPA, CPC, and CPM mean and which ad formats support
        each — this post is about the decision itself.
      </p>

      <h2>Start with what you’re confident about</h2>
      <p>
        Each model shifts risk between you and the network in a different
        place, and that risk should track your confidence in the funnel:
      </p>
      <ul>
        <li>
          <strong>CPM</strong> — you pay for impressions regardless of
          outcome. Lowest cost per unit, highest uncertainty. Use it when
          you don’t yet know how an offer performs: a new GEO, a new
          creative, or a conversion flow with several steps (a credit-card
          submit, a multi-page signup).
        </li>
        <li>
          <strong>CPC</strong> — you pay only for clicks. A middle ground:
          you’re no longer paying for eyeballs that never engage, but
          you’re still exposed if the landing page doesn’t convert clicks
          into results. Use it once you’ve validated the offer converts
          and the remaining question is landing-page performance.
        </li>
        <li>
          <strong>CPA</strong> — you pay only when the action happens
          (install, lead, signup). Highest cost per unit, lowest
          uncertainty — the network absorbs the risk of a click that goes
          nowhere. Use it when the conversion flow is simple and you
          already know your audience converts reliably.
        </li>
      </ul>

      <h2>Match the model to the conversion flow’s complexity</h2>
      <p>
        A one-tap app install and a five-field credit-card form are not the
        same kind of conversion, even if both are “the goal.” Simple,
        single-step flows (install, PIN submit, one-click signup) are where
        CPA pricing works best — there’s little for the network’s
        optimization to get wrong. Complex, multi-step flows (deposits,
        CC submits, long forms) are exactly where CPM testing pays off
        first: you learn where the flow leaks before committing to a
        per-action price.
      </p>

      <h2>A simple sequence for a new offer</h2>
      <ol>
        <li>Launch on CPM in a small test GEO to confirm the offer converts at all.</li>
        <li>
          Once click-through and landing-page conversion are stable, move
          to CPC to stop paying for impressions that never get seen.
        </li>
        <li>
          Once the funnel is proven end-to-end, negotiate CPA for the
          steady-state budget — you’ve already done the work to justify
          the lower risk.
        </li>
      </ol>
      <p>
        Skipping straight to CPA on an unproven offer is the most common
        mistake — it feels safer on paper, but an unoptimized flow under
        CPA pricing usually just means fewer approved conversions, not
        lower spend.
      </p>

      <h2>Which ad formats fit which model</h2>
      <p>
        All three models are available across{" "}
        <Link href="/ad-formats/popunder" className="text-violet-600 hover:underline">
          Popunder
        </Link>{" "}
        and{" "}
        <Link href="/ad-formats/interstitial" className="text-violet-600 hover:underline">
          Interstitial
        </Link>
        , which suit CPM testing well given their volume.{" "}
        <Link href="/ad-formats/social-bar" className="text-violet-600 hover:underline">
          Social Bar
        </Link>{" "}
        and{" "}
        <Link href="/ad-formats/in-page-push" className="text-violet-600 hover:underline">
          In-Page Push
        </Link>{" "}
        tend to hold up well on CPC once you’re optimizing for engagement
        over raw reach.
      </p>

      <blockquote>
        The pricing model is a risk-allocation decision, not just a cost
        decision — pick the one that matches how much of the funnel you’ve
        already de-risked.
      </blockquote>
    </>
  )
}
