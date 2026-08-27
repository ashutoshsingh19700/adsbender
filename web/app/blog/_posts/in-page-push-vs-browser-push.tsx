import Link from "next/link"

import type { BlogPostMeta } from "@/lib/blog"

export const meta: BlogPostMeta = {
  slug: "in-page-push-vs-browser-push",
  title: "In-Page Push vs. Browser Push: What Changed",
  description:
    "Browser push notifications used to be a reliable ad channel. Platform opt-in changes shifted that — here’s what In-Page Push does differently.",
  category: "Ad Formats",
  publishedAt: "2026-08-20",
  readingTimeMinutes: 5,
}

export function InPagePushVsBrowserPush() {
  return (
    <>
      <p>
        Browser push notifications used to be one of the more reliable
        performance channels: a subscribed user, a persistent notification
        surface, no need to be back on the site. That worked as long as
        getting the subscription in the first place was easy. It no longer
        is, and that’s the whole story behind why{" "}
        <Link href="/ad-formats/in-page-push" className="text-violet-600 hover:underline">
          In-Page Push
        </Link>{" "}
        exists as a separate format rather than a rebrand of the same idea.
      </p>

      <h2>The opt-in problem</h2>
      <p>
        Browser push depends on a visitor actively accepting a permission
        prompt — and browsers have made that prompt harder to trigger and
        easier to dismiss by default over the past several release cycles.
        A channel built entirely on an opt-in step that’s actively being
        suppressed at the platform level is a channel with a shrinking
        ceiling, no matter how good the creative is.
      </p>

      <h2>What In-Page Push does instead</h2>
      <p>
        In-Page Push renders the same notification-style unit — icon,
        headline, short body text — but places it directly in the page
        content instead of routing it through the browser’s native
        permission system. No subscription step, no permission prompt to
        dismiss, no dependency on whether the visitor previously opted in
        to anything. It behaves like a native-style ad unit that happens to
        look like a notification, rather than an actual system
        notification.
      </p>

      <h2>What that trades away — and what it doesn’t</h2>
      <p>
        The trade-off is real: In-Page Push can’t reach a visitor after
        they’ve left the page, the way a genuine push subscription can.
        What it keeps is everything that made the format work in the first
        place — the recognizable notification shape, the same impression
        volumes across GEO, device, browser, and OS, and delivery that
        doesn’t degrade as platforms keep tightening permission UX. For
        most performance campaigns, in-session delivery at full volume
        outperforms out-of-session reach at a shrinking opt-in rate.
      </p>

      <h2>Where each still makes sense</h2>
      <ul>
        <li>
          Campaigns that need re-engagement after the visitor leaves the
          site are the one case a genuine push subscription still has an
          edge — if you already have a healthy subscriber base built up
          before the opt-in changes tightened.
        </li>
        <li>
          Everything else — new traffic, new GEOs, any campaign that can’t
          rely on an existing subscriber list — is better served by
          In-Page Push’s in-session, no-opt-in delivery.
        </li>
      </ul>

      <p>
        On pricing, In-Page Push runs on{" "}
        <Link href="/pricing-models" className="text-violet-600 hover:underline">
          CPM, CPC, or CPA
        </Link>{" "}
        like the rest of the network’s formats — the format change doesn’t
        require a different pricing strategy, just a different expectation
        of who you can reach and when.
      </p>
    </>
  )
}
