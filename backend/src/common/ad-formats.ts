// Mirrors CampaignAdFormat in schema.prisma (and the value set advertisers
// pick from in web/lib/ad-formats.ts / campaign-fields.ts). Kept as a single
// array shared by CreateCampaignDto and UpdateCampaignDto so the two never
// drift out of sync with each other or with the enum.
export const AD_FORMATS = [
  // Legacy - predate the full catalog below, kept for backward
  // compatibility with existing campaigns.
  'POPUNDER',
  'SOCIAL_BAR',
  'NATIVE_BANNER',
  'IN_PAGE_PUSH',
  'INTERSTITIAL',

  // Display Ads
  'BANNER_728X90',
  'LEADERBOARD',
  'MEDIUM_RECTANGLE_300X250',
  'LARGE_RECTANGLE_336X280',
  'STICKY_BANNER',

  // Sidebar Ads
  'SKYSCRAPER_160X600',
  'WIDE_SKYSCRAPER_300X600',
  'STICKY_SIDEBAR',
  'FLOATING_SIDEBAR',

  // Native Ads
  'IN_ARTICLE',
  'IN_FEED',
  'RECOMMENDED_CONTENT',
  'SPONSORED_WIDGET',

  // Popup & Overlay Ads (POPUNDER above is reused, not repeated here)
  'POPUP',
  'EXIT_INTENT_POPUP',
  'FLOATING_OVERLAY',
  'WELCOME_SCREEN',

  // Interstitial Ads (INTERSTITIAL above doubles as "Full Screen Interstitial")
  'PAGE_TRANSITION_INTERSTITIAL',

  // Video Ads
  'PRE_ROLL',
  'MID_ROLL',
  'POST_ROLL',
  'VIDEO_OVERLAY',

  // Premium Inventory
  'HOMEPAGE_HERO_BANNER',
  'NEWSLETTER_SPONSORSHIP',
  'SPONSORED_BLOG_POST',
  'SPONSORED_SECTION',
  'STICKY_BOTTOM_BANNER',
  'FLOATING_CORNER_AD',
] as const;
