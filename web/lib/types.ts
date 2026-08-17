export type UserRole = "ADMIN" | "ADVERTISER" | "PUBLISHER"

export type AuthUser = {
  id: string
  email: string
  role: UserRole
  name?: string
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

export type CreativeType = "image" | "html"

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
  status: CampaignStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type CampaignCreative = {
  campaignId: string
  creativeType: CreativeType
  creativeUrl: string | null
  creativeHtml: string | null
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

export type PublisherSite = {
  id: string
  domain: string
  adsTxtUrl: string
  expectedText: string
  verified: boolean
  verifiedAt: string | null
  status: SiteStatus
  createdAt: string
  updatedAt: string
}

export type AdZoneStatus = "ACTIVE" | "PAUSED" | "ARCHIVED"

export type AdZone = {
  id: string
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
