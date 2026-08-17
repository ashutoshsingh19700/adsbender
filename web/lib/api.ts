import type {
  AdminCampaign,
  AdminPayout,
  AdminSite,
  AdminUser,
  AdZone,
  AdZoneStatus,
  AnalyticsResponse,
  AuthUser,
  Campaign,
  CampaignBudgetStatus,
  CampaignCreative,
  CampaignSpend,
  CampaignStatus,
  CreativeType,
  Paginated,
  Payout,
  PayoutStatus,
  Profile,
  PublisherSite,
  SiteStatus,
  TransactionType,
  UserRole,
  Wallet,
  WalletSummary,
  WalletTransaction,
} from "@/lib/types"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json")
  const payload = isJson ? await response.json() : undefined

  if (!response.ok) {
    const message =
      (payload && (payload.message?.toString?.() ?? payload.message)) ||
      response.statusText ||
      "Request failed"
    throw new ApiError(
      Array.isArray(payload?.message) ? payload.message.join(", ") : message,
      response.status
    )
  }

  return payload as T
}

// Turns { page: 1, status: "ACTIVE" } into "?page=1&status=ACTIVE",
// skipping any keys that are undefined.
function toQueryString(
  params: Record<string, string | number | boolean | undefined>
) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `?${query}` : ""
}

// --- Auth ---

export type LoginInput = { email: string; password: string }
export type RegisterInput = {
  name: string
  email: string
  password: string
  role: UserRole
}

export function login(input: LoginInput) {
  return apiFetch<{ message: string; user: AuthUser }>(
    "/api/v1/auth/login",
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function register(input: RegisterInput) {
  return apiFetch<{ message: string; user: AuthUser }>(
    "/api/v1/auth/register",
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function getProfile() {
  return apiFetch<{ message: string; user: AuthUser }>(
    "/api/v1/auth/profile"
  )
}

// Clears the auth cookie via this app's own route handler (see
// app/api/logout/route.ts) — the backend itself has no logout endpoint.
export async function logout() {
  await fetch("/api/logout", { method: "POST", credentials: "include" })
}

// --- Publisher ---

export type ValidateDomainInput = { domain: string; expectedText?: string }

export function validateDomain(input: ValidateDomainInput) {
  return apiFetch<PublisherSite>("/api/v1/publisher/domains/validate", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type CreateAdZoneInput = {
  zoneName: string
  width: number
  height: number
  layoutType: string
}

export function createAdZone(input: CreateAdZoneInput) {
  return apiFetch<{ zone: AdZone; snippet: string }>(
    "/api/v1/publisher/ad-zones",
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function getPublisherProfile() {
  return apiFetch<Profile>("/api/v1/publisher/me")
}

// --- Publisher: sites ---

export function listPublisherSites(params?: {
  page?: number
  pageSize?: number
}) {
  return apiFetch<Paginated<PublisherSite, "sites">>(
    `/api/v1/publisher/sites${toQueryString(params ?? {})}`
  )
}

export function getPublisherSite(siteId: string) {
  return apiFetch<PublisherSite>(`/api/v1/publisher/sites/${siteId}`)
}

export function updatePublisherSite(siteId: string, status: SiteStatus) {
  return apiFetch<PublisherSite>(`/api/v1/publisher/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export function deactivatePublisherSite(siteId: string) {
  return apiFetch<PublisherSite>(`/api/v1/publisher/sites/${siteId}`, {
    method: "DELETE",
  })
}

// --- Publisher: ad zones ---

export function listAdZones(params?: {
  page?: number
  pageSize?: number
  status?: AdZoneStatus
}) {
  return apiFetch<Paginated<AdZone, "zones">>(
    `/api/v1/publisher/ad-zones${toQueryString(params ?? {})}`
  )
}

export function getAdZone(zoneId: string) {
  return apiFetch<AdZone>(`/api/v1/publisher/ad-zones/${zoneId}`)
}

export type UpdateAdZoneInput = Partial<CreateAdZoneInput>

export function updateAdZone(zoneId: string, input: UpdateAdZoneInput) {
  return apiFetch<AdZone>(`/api/v1/publisher/ad-zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function updateAdZoneStatus(zoneId: string, status: AdZoneStatus) {
  return apiFetch<AdZone>(`/api/v1/publisher/ad-zones/${zoneId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export function archiveAdZone(zoneId: string) {
  return apiFetch<AdZone>(`/api/v1/publisher/ad-zones/${zoneId}`, {
    method: "DELETE",
  })
}

export function getAdZoneSnippet(zoneId: string) {
  return apiFetch<{ zoneId: string; snippet: string }>(
    `/api/v1/publisher/ad-zones/${zoneId}/snippet`
  )
}

export function getAdZonePerformance(
  zoneId: string,
  startDate: string,
  endDate: string
) {
  return apiFetch<AnalyticsResponse>(
    `/api/v1/publisher/ad-zones/${zoneId}/performance${toQueryString({
      startDate,
      endDate,
    })}`
  )
}

// --- Advertiser ---

export type CreateCampaignInput = {
  campaignName: string
  totalBudget: number
  dailyBudget: number
  maxCpc: number
  targetCountries: string[]
  targetDevices: string[]
  creativeType: CreativeType
  creativeUrl?: string
  creativeHtml?: string
  notes?: string
}

export function createCampaign(input: CreateCampaignInput) {
  return apiFetch<{ message: string; campaign: Campaign }>(
    "/api/v1/advertiser/campaigns",
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function getAdvertiserProfile() {
  return apiFetch<Profile>("/api/v1/advertiser/me")
}

export function listCampaigns(params?: {
  page?: number
  pageSize?: number
  status?: CampaignStatus
}) {
  return apiFetch<Paginated<Campaign, "campaigns">>(
    `/api/v1/advertiser/campaigns${toQueryString(params ?? {})}`
  )
}

export function getCampaign(campaignId: string) {
  return apiFetch<Campaign>(`/api/v1/advertiser/campaigns/${campaignId}`)
}

export type UpdateCampaignInput = Partial<CreateCampaignInput>

export function updateCampaign(
  campaignId: string,
  input: UpdateCampaignInput
) {
  return apiFetch<Campaign>(`/api/v1/advertiser/campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function pauseCampaign(campaignId: string) {
  return apiFetch<Campaign>(
    `/api/v1/advertiser/campaigns/${campaignId}/pause`,
    { method: "POST" }
  )
}

export function resumeCampaign(campaignId: string) {
  return apiFetch<Campaign>(
    `/api/v1/advertiser/campaigns/${campaignId}/resume`,
    { method: "POST" }
  )
}

export function archiveCampaign(campaignId: string) {
  return apiFetch<Campaign>(
    `/api/v1/advertiser/campaigns/${campaignId}/archive`,
    { method: "POST" }
  )
}

export function deleteCampaign(campaignId: string) {
  return apiFetch<{ message: string }>(
    `/api/v1/advertiser/campaigns/${campaignId}`,
    { method: "DELETE" }
  )
}

export function listCampaignCreatives(campaignId: string) {
  return apiFetch<{ creatives: CampaignCreative[] }>(
    `/api/v1/advertiser/campaigns/${campaignId}/creatives`
  )
}

export function getCampaignPerformance(
  campaignId: string,
  startDate: string,
  endDate: string
) {
  return apiFetch<AnalyticsResponse>(
    `/api/v1/advertiser/campaigns/${campaignId}/performance${toQueryString({
      startDate,
      endDate,
    })}`
  )
}

export function getCampaignSpend(campaignId: string) {
  return apiFetch<CampaignSpend>(
    `/api/v1/advertiser/campaigns/${campaignId}/spend`
  )
}

export function getCampaignBudgetStatus(campaignId: string) {
  return apiFetch<CampaignBudgetStatus>(
    `/api/v1/advertiser/campaigns/${campaignId}/budget-status`
  )
}

// --- Wallet / billing ---

export function getWallet() {
  return apiFetch<Wallet>("/api/v1/wallet")
}

export function getWalletSummary() {
  return apiFetch<WalletSummary>("/api/v1/wallet/summary")
}

export function listWalletTransactions(params?: {
  page?: number
  pageSize?: number
  type?: TransactionType
}) {
  return apiFetch<Paginated<WalletTransaction, "transactions">>(
    `/api/v1/wallet/transactions${toQueryString(params ?? {})}`
  )
}

export function depositFunds(input: { amount: number; idempotencyKey?: string }) {
  return apiFetch<{ message: string; balance: string; amount: string }>(
    "/api/v1/wallet/deposit",
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function requestPayout(input: {
  amount: number
  idempotencyKey?: string
}) {
  return apiFetch<Payout>("/api/v1/wallet/payout", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function listPayouts(params?: {
  page?: number
  pageSize?: number
  status?: PayoutStatus
}) {
  return apiFetch<Paginated<Payout, "payouts">>(
    `/api/v1/wallet/payouts${toQueryString(params ?? {})}`
  )
}

export function getPayout(payoutId: string) {
  return apiFetch<Payout>(`/api/v1/wallet/payout/${payoutId}`)
}

// --- Admin: payout ops (lives under /wallet - see wallet.controller.ts) ---

export function adminListPayouts(params?: {
  page?: number
  pageSize?: number
  status?: PayoutStatus
}) {
  return apiFetch<Paginated<AdminPayout, "payouts">>(
    `/api/v1/wallet/admin/payouts${toQueryString(params ?? {})}`
  )
}

export function adminCompletePayout(payoutId: string, providerRef?: string) {
  return apiFetch<Payout>(
    `/api/v1/wallet/admin/payouts/${payoutId}/complete`,
    { method: "PATCH", body: JSON.stringify({ providerRef }) }
  )
}

export function adminFailPayout(payoutId: string, reason?: string) {
  return apiFetch<Payout>(`/api/v1/wallet/admin/payouts/${payoutId}/fail`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  })
}

// --- Admin: campaign review, users, publisher sites ---

export function adminListCampaigns(params?: {
  page?: number
  pageSize?: number
  status?: CampaignStatus
}) {
  return apiFetch<Paginated<AdminCampaign, "campaigns">>(
    `/api/v1/admin/campaigns${toQueryString(params ?? {})}`
  )
}

export function adminGetCampaign(campaignId: string) {
  return apiFetch<AdminCampaign>(`/api/v1/admin/campaigns/${campaignId}`)
}

export function adminApproveCampaign(campaignId: string) {
  return apiFetch<Campaign>(`/api/v1/admin/campaigns/${campaignId}/approve`, {
    method: "POST",
  })
}

export function adminRejectCampaign(campaignId: string, reason?: string) {
  return apiFetch<Campaign>(`/api/v1/admin/campaigns/${campaignId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export function adminListUsers(params?: {
  page?: number
  pageSize?: number
  role?: UserRole
}) {
  return apiFetch<Paginated<AdminUser, "users">>(
    `/api/v1/admin/users${toQueryString(params ?? {})}`
  )
}

export function adminGetUser(userId: string) {
  return apiFetch<AdminUser>(`/api/v1/admin/users/${userId}`)
}

export function adminListSites(params?: {
  page?: number
  pageSize?: number
  status?: SiteStatus
  verified?: boolean
}) {
  return apiFetch<Paginated<AdminSite, "sites">>(
    `/api/v1/admin/sites${toQueryString(params ?? {})}`
  )
}

export function adminGetSite(siteId: string) {
  return apiFetch<AdminSite>(`/api/v1/admin/sites/${siteId}`)
}

export function adminUpdateSiteStatus(siteId: string, status: SiteStatus) {
  return apiFetch<PublisherSite>(`/api/v1/admin/sites/${siteId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

// --- Analytics ---

export function getDailyAnalytics(startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate })
  return apiFetch<AnalyticsResponse>(
    `/api/v1/analytics/daily?${params.toString()}`
  )
}
