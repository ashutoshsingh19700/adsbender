import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/seo"

// Everything under these prefixes requires an authenticated session
// (see proxy.ts's PROTECTED_PREFIXES + the /admin, /login, /forgot-password,
// /reset-password auth/dashboard surfaces below). None of it is content a
// search result should ever land a visitor on — either it 307s them to
// /login (redirect chains, wasted crawl budget) or it's private account
// data. Keeping this list in sync with proxy.ts + the noindex metadata on
// each of those route groups is what "no crawl issues" means here.
const DISALLOWED = [
  "/admin",
  "/advertiser",
  "/publisher",
  "/analytics",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
