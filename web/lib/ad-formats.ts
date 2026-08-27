import {
  ArrowUpRightFromSquare,
  Columns3,
  Crown,
  ExternalLink,
  FileText,
  GalleryHorizontal,
  Gift,
  Layers,
  LayoutTemplate,
  Mail,
  Maximize2,
  Megaphone,
  MonitorPlay,
  MousePointer2,
  Newspaper,
  PanelBottom,
  PanelRight,
  Pin,
  PinOff,
  Presentation,
  Rss,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Star,
  Video,
  type LucideIcon,
} from "lucide-react"

// Single source of truth for every ad format the platform supports, shared
// by the publisher's "create ad zone" flow (zone-form.ts -> AdZone.layoutType,
// a free-text column) and the advertiser's campaign wizard (campaign-fields.ts
// -> Campaign.adFormat, which mirrors the CampaignAdFormat enum in
// schema.prisma). Both sides use the SAME value for a given format so
// publisher inventory and advertiser targeting speak the same vocabulary.
//
// POPUNDER and INTERSTITIAL reuse the two pre-existing CampaignAdFormat enum
// values (Popunder / Full Screen Interstitial below) instead of minting
// duplicates - see schema.prisma.
export type AdFormatCategory =
  | "Display Ads"
  | "Sidebar Ads"
  | "Native Ads"
  | "Popup & Overlay Ads"
  | "Interstitial Ads"
  | "Video Ads"
  | "Premium Inventory"

export type AdFormatDefinition = {
  value: string
  label: string
  category: AdFormatCategory
  description: string
  icon: LucideIcon
  recommendedWidth: number
  recommendedHeight: number
}

export const AD_FORMAT_CATALOG: AdFormatDefinition[] = [
  // --- Display Ads ---
  {
    value: "BANNER_728X90",
    label: "Banner (728×90)",
    category: "Display Ads",
    description: "The classic full-size banner. Sits at the top or bottom of a page.",
    icon: RectangleHorizontal,
    recommendedWidth: 728,
    recommendedHeight: 90,
  },
  {
    value: "LEADERBOARD",
    label: "Leaderboard",
    category: "Display Ads",
    description: "A wide, high-visibility unit placed above the fold, typically in a header.",
    icon: GalleryHorizontal,
    recommendedWidth: 970,
    recommendedHeight: 90,
  },
  {
    value: "MEDIUM_RECTANGLE_300X250",
    label: "Medium Rectangle (300×250)",
    category: "Display Ads",
    description: "The most common in-content ad size - fits naturally between paragraphs.",
    icon: Square,
    recommendedWidth: 300,
    recommendedHeight: 250,
  },
  {
    value: "LARGE_RECTANGLE_336X280",
    label: "Large Rectangle (336×280)",
    category: "Display Ads",
    description: "A larger version of the medium rectangle with a higher click-through rate.",
    icon: Columns3,
    recommendedWidth: 336,
    recommendedHeight: 280,
  },
  {
    value: "STICKY_BANNER",
    label: "Sticky Banner",
    category: "Display Ads",
    description: "Stays pinned to the top or bottom of the viewport while the visitor scrolls.",
    icon: Pin,
    recommendedWidth: 320,
    recommendedHeight: 50,
  },

  // --- Sidebar Ads ---
  {
    value: "SKYSCRAPER_160X600",
    label: "Skyscraper (160×600)",
    category: "Sidebar Ads",
    description: "A tall, narrow unit for the page sidebar.",
    icon: RectangleVertical,
    recommendedWidth: 160,
    recommendedHeight: 600,
  },
  {
    value: "WIDE_SKYSCRAPER_300X600",
    label: "Wide Skyscraper (300×600)",
    category: "Sidebar Ads",
    description: "A larger sidebar unit with more room for rich creative.",
    icon: RectangleVertical,
    recommendedWidth: 300,
    recommendedHeight: 600,
  },
  {
    value: "STICKY_SIDEBAR",
    label: "Sticky Sidebar",
    category: "Sidebar Ads",
    description: "Stays in view within the sidebar as the visitor scrolls the page.",
    icon: PinOff,
    recommendedWidth: 300,
    recommendedHeight: 600,
  },
  {
    value: "FLOATING_SIDEBAR",
    label: "Floating Sidebar",
    category: "Sidebar Ads",
    description: "Floats alongside content, detached from the normal page flow.",
    icon: PanelRight,
    recommendedWidth: 160,
    recommendedHeight: 600,
  },

  // --- Native Ads ---
  {
    value: "IN_ARTICLE",
    label: "In-Article",
    category: "Native Ads",
    description: "Blends into the body of an article, between paragraphs.",
    icon: Newspaper,
    recommendedWidth: 728,
    recommendedHeight: 250,
  },
  {
    value: "IN_FEED",
    label: "In-Feed",
    category: "Native Ads",
    description: "Matches the look of items in a content feed or listing.",
    icon: Rss,
    recommendedWidth: 300,
    recommendedHeight: 250,
  },
  {
    value: "RECOMMENDED_CONTENT",
    label: "Recommended Content",
    category: "Native Ads",
    description: "Appears alongside \"you may also like\" style content recommendations.",
    icon: Sparkles,
    recommendedWidth: 300,
    recommendedHeight: 250,
  },
  {
    value: "SPONSORED_WIDGET",
    label: "Sponsored Widget",
    category: "Native Ads",
    description: "A self-contained sponsored module placed within a page's widget area.",
    icon: LayoutTemplate,
    recommendedWidth: 300,
    recommendedHeight: 300,
  },

  // --- Popup & Overlay Ads ---
  {
    value: "POPUP",
    label: "Popup",
    category: "Popup & Overlay Ads",
    description: "Opens in a new window or layer on top of the page.",
    icon: ExternalLink,
    recommendedWidth: 500,
    recommendedHeight: 400,
  },
  {
    value: "POPUNDER",
    label: "Popunder",
    category: "Popup & Overlay Ads",
    description: "Opens behind the current window, seen when the visitor closes it.",
    icon: Layers,
    recommendedWidth: 800,
    recommendedHeight: 600,
  },
  {
    value: "EXIT_INTENT_POPUP",
    label: "Exit Intent Popup",
    category: "Popup & Overlay Ads",
    description: "Triggers right as the visitor moves to leave the page.",
    icon: ArrowUpRightFromSquare,
    recommendedWidth: 500,
    recommendedHeight: 400,
  },
  {
    value: "FLOATING_OVERLAY",
    label: "Floating Overlay",
    category: "Popup & Overlay Ads",
    description: "A small overlay that floats above page content without blocking it.",
    icon: MousePointer2,
    recommendedWidth: 300,
    recommendedHeight: 250,
  },
  {
    value: "WELCOME_SCREEN",
    label: "Welcome Screen",
    category: "Popup & Overlay Ads",
    description: "A full-page greeting shown to first-time or returning visitors.",
    icon: Gift,
    recommendedWidth: 640,
    recommendedHeight: 480,
  },

  // --- Interstitial Ads ---
  {
    value: "INTERSTITIAL",
    label: "Full Screen Interstitial",
    category: "Interstitial Ads",
    description: "Covers the entire screen between page views.",
    icon: Maximize2,
    recommendedWidth: 1024,
    recommendedHeight: 768,
  },
  {
    value: "PAGE_TRANSITION_INTERSTITIAL",
    label: "Page Transition Interstitial",
    category: "Interstitial Ads",
    description: "Shown briefly while the visitor navigates from one page to the next.",
    icon: Presentation,
    recommendedWidth: 1024,
    recommendedHeight: 768,
  },

  // --- Video Ads ---
  {
    value: "PRE_ROLL",
    label: "Pre-roll",
    category: "Video Ads",
    description: "Plays before the main video content starts.",
    icon: SkipBack,
    recommendedWidth: 640,
    recommendedHeight: 360,
  },
  {
    value: "MID_ROLL",
    label: "Mid-roll",
    category: "Video Ads",
    description: "Plays during a natural break in the middle of video content.",
    icon: MonitorPlay,
    recommendedWidth: 640,
    recommendedHeight: 360,
  },
  {
    value: "POST_ROLL",
    label: "Post-roll",
    category: "Video Ads",
    description: "Plays after the main video content finishes.",
    icon: SkipForward,
    recommendedWidth: 640,
    recommendedHeight: 360,
  },
  {
    value: "VIDEO_OVERLAY",
    label: "Video Overlay",
    category: "Video Ads",
    description: "A semi-transparent banner overlaid on top of video content during playback.",
    icon: Video,
    recommendedWidth: 480,
    recommendedHeight: 70,
  },

  // --- Premium Inventory ---
  {
    value: "HOMEPAGE_HERO_BANNER",
    label: "Homepage Hero Banner",
    category: "Premium Inventory",
    description: "The top, most prominent banner slot on the homepage.",
    icon: Star,
    recommendedWidth: 1200,
    recommendedHeight: 400,
  },
  {
    value: "NEWSLETTER_SPONSORSHIP",
    label: "Newsletter Sponsorship",
    category: "Premium Inventory",
    description: "A sponsored placement inside an email newsletter.",
    icon: Mail,
    recommendedWidth: 600,
    recommendedHeight: 200,
  },
  {
    value: "SPONSORED_BLOG_POST",
    label: "Sponsored Blog Post",
    category: "Premium Inventory",
    description: "An in-line banner embedded within a sponsored blog article.",
    icon: FileText,
    recommendedWidth: 728,
    recommendedHeight: 90,
  },
  {
    value: "SPONSORED_SECTION",
    label: "Sponsored Section",
    category: "Premium Inventory",
    description: "A dedicated, clearly-labeled sponsored section of a page.",
    icon: Megaphone,
    recommendedWidth: 970,
    recommendedHeight: 250,
  },
  {
    value: "STICKY_BOTTOM_BANNER",
    label: "Sticky Bottom Banner",
    category: "Premium Inventory",
    description: "Anchored to the bottom of the viewport across the whole visit.",
    icon: PanelBottom,
    recommendedWidth: 320,
    recommendedHeight: 50,
  },
  {
    value: "FLOATING_CORNER_AD",
    label: "Floating Corner Ad",
    category: "Premium Inventory",
    description: "A small unit anchored to a page corner, dismissible by the visitor.",
    icon: Crown,
    recommendedWidth: 250,
    recommendedHeight: 250,
  },
]

export const AD_FORMAT_CATEGORIES: AdFormatCategory[] = [
  "Display Ads",
  "Sidebar Ads",
  "Native Ads",
  "Popup & Overlay Ads",
  "Interstitial Ads",
  "Video Ads",
  "Premium Inventory",
]

export function getAdFormat(value: string | null | undefined) {
  return AD_FORMAT_CATALOG.find((f) => f.value === value) ?? null
}

export function adFormatLabel(value: string | null | undefined) {
  return getAdFormat(value)?.label ?? value ?? ""
}
