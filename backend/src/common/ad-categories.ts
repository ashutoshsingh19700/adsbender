// Content/vertical categories a campaign can be tagged with (Campaign.category)
// and a publisher's ad zone can be restricted to (AdZone.allowedCategories).
// Mirrors WEBSITE_CATEGORIES in web/app/publisher/websites/site-meta.ts and
// its frontend counterpart web/lib/ad-categories.ts - kept as a plain string
// list (not a DB enum) so it can grow without a migration, same reasoning as
// PublisherSite.category.
export const AD_CATEGORIES = [
  'Entertainment',
  'News & Media',
  'Technology',
  'Games',
  'Sports',
  'Lifestyle & Fashion',
  'Business & Finance',
  'Education',
  'Health & Wellness',
  'Adult',
  'Other',
] as const;
