import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/seo"
import { getAllPosts } from "@/lib/blog"

// Every public, indexable route in one place. When a new public marketing
// page is added (see the SEO report's "recommended pages" list — /about,
// /contact, /case-studies, /book-call), add it here in the same edit as
// creating its page.tsx. Gated dashboard routes (/admin, /advertiser/*,
// /publisher/*, /analytics) and auth routes (/login, /forgot-password,
// /reset-password) deliberately stay out — they're disallowed in robots.ts
// and noindexed on the page itself. Same for /contact and /case-studies,
// which exist but are noindexed until their placeholder content is real.
const STATIC_ROUTES: {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/services", changeFrequency: "monthly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pricing-models", changeFrequency: "monthly", priority: 0.9 },
  { path: "/publishers/benefits", changeFrequency: "monthly", priority: 0.9 },
  { path: "/ad-formats/popunder", changeFrequency: "monthly", priority: 0.8 },
  { path: "/ad-formats/social-bar", changeFrequency: "monthly", priority: 0.8 },
  { path: "/ad-formats/interstitial", changeFrequency: "monthly", priority: 0.8 },
  { path: "/ad-formats/in-page-push", changeFrequency: "monthly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/glossary", changeFrequency: "monthly", priority: 0.5 },
  // "/schedule-meeting" is deliberately excluded — it's noindexed as thin
  // placeholder content (see its page.tsx). Add it back once real content
  // ships and the noindex is lifted.
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
  const postEntries = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))
  return [...staticEntries, ...postEntries]
}
