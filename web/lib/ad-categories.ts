// Content/vertical categories shared by the advertiser's campaign wizard
// (Campaign.category) and the publisher's ad-zone form (AdZone.allowedCategories).
// Mirrors AD_CATEGORIES in backend/src/common/ad-categories.ts and the values
// already offered for a website's own category in
// web/app/publisher/websites/site-meta.ts (WEBSITE_CATEGORIES) - kept as a
// separate copy the same way ad-formats.ts mirrors the backend's AD_FORMATS,
// since the two apps don't share a package.
export const AD_CATEGORIES = [
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

export type AdCategory = (typeof AD_CATEGORIES)[number]
