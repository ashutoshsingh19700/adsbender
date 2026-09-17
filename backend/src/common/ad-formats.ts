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

// Exact pixel size each format's creative must be uploaded at (mirrors
// recommendedWidth/recommendedHeight in web/lib/ad-formats.ts - kept as a
// second copy the same way MAX_CREATIVE_UPLOAD_BYTES is mirrored on the
// frontend, since the two apps don't share a package). Used by
// CreativeUploadService to reject an image whose dimensions don't match the
// campaign's chosen adFormat - a stretched/cropped creative is worse than a
// blocked upload. Legacy formats predating the sized catalog (POPUNDER,
// SOCIAL_BAR, NATIVE_BANNER, IN_PAGE_PUSH, INTERSTITIAL) have no fixed pixel
// size and are intentionally left out, so uploads for them skip the check.
export const AD_FORMAT_DIMENSIONS: Partial<
  Record<(typeof AD_FORMATS)[number], { width: number; height: number }>
> = {
  // Display Ads
  BANNER_728X90: { width: 728, height: 90 },
  LEADERBOARD: { width: 970, height: 90 },
  MEDIUM_RECTANGLE_300X250: { width: 300, height: 250 },
  LARGE_RECTANGLE_336X280: { width: 336, height: 280 },
  STICKY_BANNER: { width: 320, height: 50 },

  // Sidebar Ads
  SKYSCRAPER_160X600: { width: 160, height: 600 },
  WIDE_SKYSCRAPER_300X600: { width: 300, height: 600 },
  STICKY_SIDEBAR: { width: 300, height: 600 },
  FLOATING_SIDEBAR: { width: 160, height: 600 },

  // Native Ads
  IN_ARTICLE: { width: 728, height: 250 },
  IN_FEED: { width: 300, height: 250 },
  RECOMMENDED_CONTENT: { width: 300, height: 250 },
  SPONSORED_WIDGET: { width: 300, height: 300 },

  // Popup & Overlay Ads
  POPUP: { width: 500, height: 400 },
  EXIT_INTENT_POPUP: { width: 500, height: 400 },
  FLOATING_OVERLAY: { width: 300, height: 250 },
  WELCOME_SCREEN: { width: 640, height: 480 },

  // Interstitial Ads
  PAGE_TRANSITION_INTERSTITIAL: { width: 1024, height: 768 },

  // Video Ads
  PRE_ROLL: { width: 640, height: 360 },
  MID_ROLL: { width: 640, height: 360 },
  POST_ROLL: { width: 640, height: 360 },
  VIDEO_OVERLAY: { width: 480, height: 70 },

  // Premium Inventory
  HOMEPAGE_HERO_BANNER: { width: 1200, height: 400 },
  NEWSLETTER_SPONSORSHIP: { width: 600, height: 200 },
  SPONSORED_BLOG_POST: { width: 728, height: 90 },
  SPONSORED_SECTION: { width: 970, height: 250 },
  STICKY_BOTTOM_BANNER: { width: 320, height: 50 },
  FLOATING_CORNER_AD: { width: 250, height: 250 },
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
