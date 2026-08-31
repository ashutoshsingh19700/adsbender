// The publisher-sites API (see lib/api.ts) now stores category and adultAds
// directly on PublisherSite - only the ad unit formats picked in the "Add
// new Website" dialog still have no backend column. Rather than add a
// migration for what's essentially a UI shortcut (the real place to define
// a zone's ad format is the "Create an ad zone" step), we keep that one
// field client-side, per browser, keyed by domain. If the domain is later
// re-added on another device this just starts empty again.
export type SiteMeta = {
  adUnitFormats?: string[]
}

const STORAGE_KEY = "adnetwork.publisher.siteMeta"

function readAll(): Record<string, SiteMeta> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, SiteMeta>) : {}
  } catch {
    return {}
  }
}

export function getSiteMeta(domain: string): SiteMeta {
  return readAll()[domain] ?? {}
}

export function setSiteMeta(domain: string, meta: SiteMeta) {
  if (typeof window === "undefined") return
  const all = readAll()
  all[domain] = meta
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Storage full or unavailable (private browsing) — not worth surfacing.
  }
}

export const WEBSITE_CATEGORIES = [
  "Entertainment",
  "News & Media",
  "Technology",
  "Games",
  "Sports",
  "Lifestyle & Fashion",
  "Business & Finance",
  "Education",
  "Health & Wellness",
  "Adult",
  "Other",
] as const

export const AD_UNIT_FORMAT_OPTIONS = [
  { value: "popunder", label: "Popunder", top: true },
  { value: "smartlink", label: "Smartlink", top: false },
  { value: "native-banner", label: "Native Banner", top: false },
  { value: "social-bar", label: "Social Bar", top: true },
  { value: "banner", label: "Banner", top: false },
] as const
