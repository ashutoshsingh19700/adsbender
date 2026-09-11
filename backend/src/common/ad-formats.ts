// Pre-catalog free-text values a publisher's ad zone could be created with
// (see LEGACY_LAYOUT_TYPES in web/app/publisher/zone-form.ts) - not a
// CampaignAdFormat enum value, so a campaign can never target one of these
// by adFormat (they only ever fall back to inline rendering, and only match
// a wildcard campaign with no adFormat set - see AdTargetingService). Kept
// valid on AdZone.layoutType purely so existing zones already created with
// these values (and the form's own default) don't break.
export const LEGACY_ZONE_LAYOUT_TYPES = [
  'banner',
  'sidebar',
  'in-content',
  'sticky-footer',
] as const;

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

// What AdZone.layoutType is actually validated against (see
// CreateAdZoneDto/UpdateAdZoneDto) - the full campaign-targetable catalog
// plus the pre-catalog legacy values above, since a zone (unlike a
// campaign) can validly exist with one of those.
export const ZONE_LAYOUT_TYPES = [...AD_FORMATS, ...LEGACY_ZONE_LAYOUT_TYPES];

// The closed set of actual serving BEHAVIORS the 27 formats above map onto -
// see AdEngineController.serve (adds `renderFamily` to the /serve response)
// and publisher_tag.js (dispatches on it). Many formats intentionally share
// a family: e.g. STICKY_SIDEBAR and STICKY_BOTTOM_BANNER both render as
// `sticky`/`floating` even though they're different catalog entries, because
// the underlying DOM/JS behavior is the same.
export type RenderFamily =
  | 'inline'
  | 'sticky'
  | 'floating'
  | 'native'
  | 'popup'
  | 'popunder'
  | 'exit_intent'
  | 'welcome_screen'
  | 'interstitial'
  | 'page_transition'
  | 'video'
  | 'video_overlay'
  | 'newsletter';

export const RENDER_FAMILY_BY_FORMAT: Record<
  (typeof AD_FORMATS)[number],
  RenderFamily
> = {
  // Legacy
  POPUNDER: 'popunder',
  SOCIAL_BAR: 'inline',
  NATIVE_BANNER: 'inline',
  IN_PAGE_PUSH: 'inline',
  INTERSTITIAL: 'interstitial',

  // Display Ads
  BANNER_728X90: 'inline',
  LEADERBOARD: 'inline',
  MEDIUM_RECTANGLE_300X250: 'inline',
  LARGE_RECTANGLE_336X280: 'inline',
  STICKY_BANNER: 'sticky',

  // Sidebar Ads
  SKYSCRAPER_160X600: 'inline',
  WIDE_SKYSCRAPER_300X600: 'inline',
  STICKY_SIDEBAR: 'sticky',
  FLOATING_SIDEBAR: 'floating',

  // Native Ads
  IN_ARTICLE: 'native',
  IN_FEED: 'native',
  RECOMMENDED_CONTENT: 'native',
  SPONSORED_WIDGET: 'native',

  // Popup & Overlay Ads
  POPUP: 'popup',
  EXIT_INTENT_POPUP: 'exit_intent',
  FLOATING_OVERLAY: 'floating',
  WELCOME_SCREEN: 'welcome_screen',

  // Interstitial Ads
  PAGE_TRANSITION_INTERSTITIAL: 'page_transition',

  // Video Ads
  PRE_ROLL: 'video',
  MID_ROLL: 'video',
  POST_ROLL: 'video',
  VIDEO_OVERLAY: 'video_overlay',

  // Premium Inventory
  HOMEPAGE_HERO_BANNER: 'inline',
  NEWSLETTER_SPONSORSHIP: 'newsletter',
  SPONSORED_BLOG_POST: 'inline',
  SPONSORED_SECTION: 'inline',
  STICKY_BOTTOM_BANNER: 'floating',
  FLOATING_CORNER_AD: 'floating',
};

export function renderFamilyForFormat(
  format: string | null | undefined,
): RenderFamily {
  if (format && format in RENDER_FAMILY_BY_FORMAT) {
    return RENDER_FAMILY_BY_FORMAT[format as (typeof AD_FORMATS)[number]];
  }

  // No format (legacy zone/campaign predating this feature) - fall back to
  // the plain inline behavior every format used to have.
  return 'inline';
}
