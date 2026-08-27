import type { ComponentType } from "react"

import { CpaCpcCpmDecisionFramework, meta as cpaCpcCpmMeta } from "@/app/blog/_posts/cpa-cpc-cpm-decision-framework"
import { PopunderVsInterstitial, meta as popunderVsInterstitialMeta } from "@/app/blog/_posts/popunder-vs-interstitial"
import { InPagePushVsBrowserPush, meta as inPagePushVsBrowserPushMeta } from "@/app/blog/_posts/in-page-push-vs-browser-push"
import { AdZoneCoreWebVitals, meta as adZoneCoreWebVitalsMeta } from "@/app/blog/_posts/ad-zone-core-web-vitals"

export type BlogCategory = "Pricing" | "Ad Formats" | "Publishers"

export type BlogPostMeta = {
  slug: string
  title: string
  description: string
  category: BlogCategory
  publishedAt: string // ISO date
  readingTimeMinutes: number
}

// Each post is a plain TSX component + a co-located `meta` export under
// app/blog/_posts/ (the "_" prefix keeps Next from treating that folder as
// a route). This file is just the registry tying meta to content — no MDX
// pipeline, no CMS, so adding a post is "add one file, list it here."
const REGISTRY: { meta: BlogPostMeta; Content: ComponentType }[] = [
  { meta: cpaCpcCpmMeta, Content: CpaCpcCpmDecisionFramework },
  { meta: popunderVsInterstitialMeta, Content: PopunderVsInterstitial },
  { meta: inPagePushVsBrowserPushMeta, Content: InPagePushVsBrowserPush },
  { meta: adZoneCoreWebVitalsMeta, Content: AdZoneCoreWebVitals },
]

export function getAllPosts(): BlogPostMeta[] {
  return REGISTRY.map((entry) => entry.meta).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}

export function getPost(slug: string) {
  return REGISTRY.find((entry) => entry.meta.slug === slug)
}

export function getRelatedPosts(slug: string, limit = 2): BlogPostMeta[] {
  const current = getPost(slug)
  if (!current) return []
  return getAllPosts()
    .filter((post) => post.slug !== slug && post.category === current.meta.category)
    .slice(0, limit)
}
