export type UserRole = "ADMIN" | "ADVERTISER" | "PUBLISHER"

// Only meaningful when role === "ADMIN" - see backend AdminScope. MASTER
// sees/does everything; PUBLISHER/ADVERTISER admins are scoped to their
// side of the marketplace. null/undefined for a non-admin user, or a
// legacy admin created before scopes existed (treated as MASTER).
export type AdminScope = "MASTER" | "PUBLISHER" | "ADVERTISER" | null

export type AuthUser = {
  id: string
  email: string
  role: UserRole
  name?: string
  adminScope?: AdminScope
  // ISO 3166-1 alpha-2 code picked at signup, or null/undefined if never
  // set. India ("IN") is charged 18% GST on wallet top-ups - see the Add
  // funds page.
  country?: string | null
}

// Returned by GET /publisher/me and /advertiser/me.
export type Profile = {
  id: string
  name: string
  email: string
  role: UserRole
  balance_usd: string
  createdAt: string
}

export type CampaignStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED"

export type CreativeType = "image" | "video" | "html"

// Mirrors CampaignAdFormat in schema.prisma - kept as `string` rather than a
// literal union since the full set of values lives in one place,
// web/lib/ad-formats.ts (AD_FORMAT_CATALOG), plus a few legacy values kept
// for backward compatibility (see campaign-fields.ts).
export type CampaignAdFormat = string

export type CampaignPricingModel = "CPM" | "CPA" | "CPC"

export type CampaignStartMode =
  | "START_ONCE_VERIFIED"
  | "SCHEDULE"
  | "KEEP_INACTIVE"

export type CampaignLocation = {
  country: string
  region?: string
  city?: string
  include: boolean
}

export type Campaign = {
  id: string
  campaignName: string
  totalBudget: string
  dailyBudget: string
  maxCpc: string
  targetCountries: string[]
  targetDevices: string[]
  creativeType: CreativeType
  creativeUrl: string | null
  creativeHtml: string | null
  destinationUrl: string | null
  status: CampaignStatus
  notes: string | null
  // Adsterra-style setup fields - stored but not yet enforced by ad
  // serving (see backend's AdvertiserService / schema.prisma comments).
  adFormat: CampaignAdFormat | null
  pricingModel: CampaignPricingModel
  countryPricing: Record<string, number> | null
  locations: CampaignLocation[] | null
  budgetUnlimited: boolean
  startMode: CampaignStartMode
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
}

export type CampaignCreative = {
  campaignId: string
  creativeType: CreativeType
  creativeUrl: string | null
  creativeHtml: string | null
  destinationUrl: string | null
}

export type CampaignSpend = {
  campaignId: string
  totalBudget: number
  spendToDate: number
  remainingBudget: number
}

export type CampaignBudgetStatus = {
  campaignId: string
  status: CampaignStatus
  totalBudget: number
  dailyBudget: number
  spentToday: number
  spentTotal: number
  remainingToday: number
  remainingTotal: number
  dailyBudgetExhausted: boolean
  totalBudgetExhausted: boolean
}

export type SiteStatus = "ACTIVE" | "INACTIVE"

export type SiteVerificationMethod = "ADS_TXT" | "AD_SNIPPET"

export type PublisherSite = {
  id: string
  domain: string
  adsTxtUrl: string | null
  expectedText: string | null
  verificationMethod: SiteVerificationMethod
  verified: boolean
  verifiedAt: string | null
  status: SiteStatus
  // Set from the "Add new Website" dialog - see PublisherSite.category /
  // .adultAds in the backend's schema.prisma for why category is freeform
  // rather than a fixed enum.
  category: string | null
  adultAds: boolean
  // ISO 3166-1 alpha-2 code for this site's primary traffic country, if the
  // publisher set one - feeds the advertiser-facing country allow-list.
  country: string | null
  createdAt: string
  updatedAt: string
}

export type AdZoneStatus = "ACTIVE" | "PAUSED" | "ARCHIVED"

export type AdZone = {
  id: string
  // Set when the zone was created for a specific website (see
  // web/app/publisher/websites/add-website-dialog.tsx) - null for zones
  // created from the generic Publisher Portal flow.
  siteId: string | null
  zoneName: string
  width: number
  height: number
  layoutType: string
  status: AdZoneStatus
  createdAt: string
  updatedAt: string
}

// --- Wallet / billing ---

export type TransactionType =
  | "DEPOSIT"
  | "CAMPAIGN_RESERVATION"
  | "AD_SPEND"
  | "REFUND"
  | "PUBLISHER_EARNING"
  | "PAYOUT_REQUEST"
  | "PAYOUT_COMPLETED"
  | "PAYOUT_FAILED"
  | "ADJUSTMENT"

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED"

export type WalletTransaction = {
  id: string
  walletId: string
  userId: string
  type: TransactionType
  amount: string
  currency: string
  status: TransactionStatus
  referenceId: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

// Returned by GET /wallet - shared fields plus one of the two role-specific
// unions below (advertiser gets `currentBalance`, publisher gets
// `availableEarnings`/`currentEarnings`).
export type WalletBase = {
  walletId: string
  currency: string
  availableBalance: string
  reservedBalance: string
  totalDeposited: string
  totalSpent: string
  totalEarned: string
  totalWithdrawn: string
  pendingEarnings: string
  updatedAt: string
}

export type AdvertiserWallet = WalletBase & { currentBalance: string }
export type PublisherWallet = WalletBase & {
  availableEarnings: string
  currentEarnings: string
}

export type Wallet = AdvertiserWallet | PublisherWallet

export type CampaignSpendingSummary = {
  campaignId: string
  campaignName: string
  status: CampaignStatus
  totalBudget: string
  reserved: string
  spent: string
  remaining: string
}

export type AdvertiserWalletSummary = AdvertiserWallet & {
  campaignSpending: CampaignSpendingSummary[]
}

export type PublisherWalletSummary = PublisherWallet & {
  pendingPayoutCount: number
  lifetimePayoutsCompleted: string
  minimumPayoutThreshold: string
}

export type WalletSummary = AdvertiserWalletSummary | PublisherWalletSummary

export type BeneficiaryAccountType = "BANK_ACCOUNT" | "VPA"

// A publisher's payout destination - what RazorpayXPayoutProvider pays out
// to. bankAccountNumber/ifscCode are set for BANK_ACCOUNT, vpa for VPA.
export type BeneficiaryAccount = {
  id: string
  userId: string
  accountType: BeneficiaryAccountType
  accountHolderName: string
  bankAccountNumber: string | null
  ifscCode: string | null
  vpa: string | null
  createdAt: string
  updatedAt: string
}

export type SetBeneficiaryAccountInput = {
  accountType: BeneficiaryAccountType
  accountHolderName: string
  bankAccountNumber?: string
  ifscCode?: string
  vpa?: string
}

export type PayoutStatus = "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED"

export type Payout = {
  id: string
  walletId: string
  userId: string
  amount: string
  currency: string
  status: PayoutStatus
  provider: string | null
  providerRef: string | null
  failureReason: string | null
  requestedAt: string
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

// Shape shared by every paginated list endpoint (?page=&pageSize=).
export type Paginated<T, Key extends string> = { page: number; pageSize: number; total: number } & {
  [K in Key]: T[]
}

export type NotificationType =
  | "CAMPAIGN_APPROVED"
  | "CAMPAIGN_REJECTED"
  | "DEPOSIT_CONFIRMED"
  | "PAYOUT_COMPLETED"
  | "PAYOUT_FAILED"

export type Notification = {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

export type NotificationsResponse = {
  notifications: Notification[]
  total: number
  page: number
  pageSize: number
  unreadCount: number
}

export type AnalyticsRow = {
  date: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  payout: number
}

export type AnalyticsTotals = {
  impressions: number
  clicks: number
  spend: number
  payout: number
  ctr: number
}

export type AnalyticsResponse = {
  rows: AnalyticsRow[]
  totals: AnalyticsTotals
}

// --- Publisher: Statistics ---
// "browser" and "operating system" aren't offered as group-by dimensions -
// the backend stores the raw user_agent per event but never parses either
// out of it, so there's nothing to group by (see PublisherService.getStatistics).
export type StatisticsGroupBy =
  | "date"
  | "domain"
  | "placement"
  | "country"
  | "device"

export type StatisticsRow = {
  // Raw group value (a date, domain, zone id, country code, or device type).
  key: string
  // Human-readable version - only differs from `key` for "placement", where
  // it's the zone's name instead of its id.
  label: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  payout: number
}

export type StatisticsResponse = {
  groupBy: StatisticsGroupBy
  totals: AnalyticsTotals
  rows: StatisticsRow[]
}

// --- Admin ---

export type UserSummary = { id: string; name: string; email: string }

// GET /admin/campaigns, /admin/campaigns/:id - the same Campaign shape the
// advertiser sees, plus who owns it.
export type AdminCampaign = Campaign & { advertiser: UserSummary }

// GET /admin/users, /admin/users/:id - same fields as Profile but returned
// as a list-friendly flat object (no wrapper message).
export type AdminUser = {
  id: string
  name: string
  email: string
  role: UserRole
  balance_usd: string
  createdAt: string
}

// GET /admin/sites, /admin/sites/:id
export type AdminSite = PublisherSite & { publisher: UserSummary }

// GET /wallet/admin/payouts
export type AdminPayout = Payout & { wallet: { user: UserSummary } }

// GET /admin/advertisers, /admin/publishers - country/date breakdown row,
// same shape the publisher Statistics screen groups by (see StatisticsRow)
// but unlabeled - `key` is a raw country code ("US") or date ("YYYY-MM-DD").
export type AdminGroupedRow = {
  key: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  payout: number
}

// GET /admin/advertisers
export type AdminAdvertiserSummary = AdminUser & {
  country: string | null
  campaignCount: number
  totalSpend: string
}

// GET /admin/advertisers/:id
export type AdminAdvertiserDetail = {
  advertiser: AdminUser & { country: string | null }
  campaigns: {
    id: string
    campaignName: string
    status: CampaignStatus
    totalBudget: string
    spentAmount: string
    targetCountries: string[]
    createdAt: string
  }[]
  totalSpend: string
  audienceByCountry: AdminGroupedRow[]
  trafficByDate: AdminGroupedRow[]
  totals: AnalyticsTotals
  range: { startDate: string; endDate: string }
}

// GET /admin/publishers
export type AdminPublisherSummary = AdminUser & {
  country: string | null
  siteCount: number
  totalEarned: string
  pendingEarnings: string
  totalWithdrawn: string
}

// GET /admin/publishers/:id
export type AdminPublisherDetail = {
  publisher: AdminUser & {
    country: string | null
    totalEarned: string
    pendingEarnings: string
    totalWithdrawn: string
  }
  sites: {
    id: string
    domain: string
    status: SiteStatus
    verified: boolean
    country: string | null
    createdAt: string
  }[]
  payouts: Payout[]
  audienceByCountry: AdminGroupedRow[]
  trafficByDate: AdminGroupedRow[]
  totals: AnalyticsTotals
  range: { startDate: string; endDate: string }
}

// GET /admin/revenue/summary - lifetime, platform-wide financial rollup.
// All amounts are decimal strings, same convention as the rest of the API.
export type RevenueSummary = {
  totalAdSpend: string
  totalPublisherEarned: string
  platformRevenue: string
  totalDeposited: string
  totalPayoutsCompleted: string
  outstandingPublisherLiability: string
  pendingPayoutCount: number
  pendingPayoutAmount: string
}

// GET /admin/revenue/breakdown - master-admin-only. Explains + proves
// exactly how a billed event splits between advertiser charge, publisher
// payout, and the platform's own cut.
export type RevenueBreakdownEvent = {
  referenceId: string | null
  description: string | null
  occurredAt: string
  advertiser: { name: string; email: string } | null
  publisher: { name: string; email: string } | null
  advertiserCharged: string
  publisherPaid: string | null
  platformKept: string | null
  settled: boolean
}

export type RevenueBreakdown = {
  platformFeeBps: number
  platformFeePercent: string
  publisherSharePercent: string
  explanation: string
  worked_example: {
    advertiserCharged: string
    publisherPaid: string
    platformKept: string
  }
  recentEvents: RevenueBreakdownEvent[]
}

// --- Traffic quality / fraud protection ---
// GET /admin/traffic-quality, /publisher/traffic-quality,
// /advertiser/traffic-quality - see AnalyticsService.getTrafficQuality.
// "Blocked" traffic never got an ad / never got tracked at all; "flagged"
// traffic was allowed through but looked suspicious enough to record (e.g. a
// datacenter IP) - see FraudDetectionService.
export type TrafficQualityReasonRow = {
  reason: string
  stage: "impression" | "click"
  blocked: number
  flagged: number
}

export type TrafficQualityDateRow = {
  date: string
  blocked: number
  flagged: number
}

export type TrafficQualityResponse = {
  totalBlocked: number
  totalFlagged: number
  byReason: TrafficQualityReasonRow[]
  byDate: TrafficQualityDateRow[]
}

// GET /admin/blacklist
export type BlacklistedIp = {
  id: string
  ipAddress: string
  source: string
  reason: string
  createdAt: string
  updatedAt: string
}
