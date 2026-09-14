import type {
  AdminAdvertiserDetail,
  AdminAdvertiserSummary,
  AdminCampaign,
  AdminPayout,
  AdminPublisherDetail,
  AdminPublisherSummary,
  AdminSite,
  AdminUser,
  AdZone,
  AdZoneStatus,
  AnalyticsResponse,
  AuthUser,
  BeneficiaryAccount,
  BlacklistedIp,
  Campaign,
  CampaignAdFormat,
  CampaignBudgetStatus,
  CampaignCreative,
  CampaignLocation,
  CampaignPricingModel,
  CampaignSpend,
  CampaignStartMode,
  CampaignStatus,
  CreativeType,
  Notification,
  NotificationsResponse,
  Paginated,
  Payout,
  PayoutStatus,
  Profile,
  PublisherSite,
  RevenueBreakdown,
  RevenueSummary,
  SetBeneficiaryAccountInput,
  SiteStatus,
  StatisticsGroupBy,
  StatisticsResponse,
  TrafficQualityResponse,
  TransactionType,
  UserRole,
  Wallet,
  WalletSummary,
  WalletTransaction,
} from "@/lib/types"

// Left empty by default so requests go to this app's own origin
// (/api/v1/...) and get rewritten server-side to BACKEND_ORIGIN - see
// next.config.ts. That keeps the backend's session cookie first-party to
// this app's domain. Only set NEXT_PUBLIC_API_URL to call the backend
// directly from the browser (cross-origin), which breaks cookie auth
// unless the backend and frontend share a domain.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ""

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

// Dedupes identical concurrent GET requests (e.g. /api/v1/wallet/summary,
// independently fetched by the topbar and a page that are mounted at the
// same time) so two components asking for the same data in the same tick
// share one network round trip instead of doubling load on the backend.
const inFlightGetRequests = new Map<string, Promise<unknown>>()

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase()

  const doFetch = async (): Promise<T> => {
    // FormData bodies (file uploads) must NOT get a manual Content-Type -
    // the browser sets one itself with the multipart boundary, and
    // overriding it here would drop the boundary and break parsing.
    const isFormData = init?.body instanceof FormData

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

  if (method !== "GET") {
    return doFetch()
  }

  const existing = inFlightGetRequests.get(path)
  if (existing) return existing as Promise<T>

  const promise = doFetch().finally(() => {
    inFlightGetRequests.delete(path)
  })
  inFlightGetRequests.set(path, promise)
  return promise
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

export type LoginInput = {
  email: string
  password: string
  captchaToken: string
}
export type RegisterInput = {
  name: string
  email: string
  password: string
  role: UserRole
  // ISO 3166-1 alpha-2 code picked on the signup form - drives GST on
  // wallet top-ups later (see the Add funds page) and nothing else yet.
  country?: string
  captchaToken: string
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

export function forgotPassword(input: { email: string; captchaToken: string }) {
  return apiFetch<{ message: string }>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function resetPassword(input: { accessToken: string; password: string }) {
  return apiFetch<{ message: string }>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function sendPhoneOtp(input: { phone: string; captchaToken: string }) {
  return apiFetch<{ message: string }>("/api/v1/auth/phone/send-otp", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type VerifyPhoneOtpInput = {
  phone: string
  token: string
  name?: string
  role?: UserRole
  country?: string
}

export function verifyPhoneOtp(input: VerifyPhoneOtpInput) {
  return apiFetch<{ message: string; user: AuthUser }>(
    "/api/v1/auth/phone/verify-otp",
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function googleAuth(input: {
  idToken: string
  role?: UserRole
  country?: string
}) {
  return apiFetch<{ message: string; user: AuthUser }>("/api/v1/auth/google", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// Clears the auth cookie via this app's own route handler (see
// app/api/logout/route.ts) — the backend itself has no logout endpoint.
export async function logout() {
  await fetch("/api/logout", { method: "POST", credentials: "include" })
}

// --- Publisher ---

export type ValidateDomainInput = {
  domain: string
  expectedText?: string
  category?: string
  adultAds?: boolean
  country?: string
}

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
  // Ties the zone to one of the publisher's sites so it can be nested under
  // that site on the Websites page - optional, same as on the backend DTO.
  siteId?: string
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

export type UpdatePublisherSiteInput = {
  status?: SiteStatus
  category?: string
  adultAds?: boolean
  // ISO 3166-1 alpha-2 code for this site's primary traffic country - lets a
  // publisher fill this in on a site that predates the field (see
  // PublisherSite.country in the backend schema).
  country?: string
}

export function updatePublisherSite(
  siteId: string,
  input: SiteStatus | UpdatePublisherSiteInput
) {
  const body = typeof input === "string" ? { status: input } : input
  return apiFetch<PublisherSite>(`/api/v1/publisher/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
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
  siteId?: string
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

// Newsletter Sponsorship zones can't use the live JS tag (email clients
// block scripts) - see PublisherService.getNewsletterSnippet on the
// backend for the static HTML this returns instead.
export function getNewsletterSnippet(zoneId: string) {
  return apiFetch<{ zoneId: string; snippet: string }>(
    `/api/v1/publisher/ad-zones/${zoneId}/newsletter-snippet`
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

export function getPublisherStatistics(params: {
  startDate: string
  endDate: string
  country?: string
  domain?: string
  zoneId?: string
  groupBy?: StatisticsGroupBy
}) {
  return apiFetch<StatisticsResponse>(
    `/api/v1/publisher/statistics${toQueryString(params)}`
  )
}

export function getPublisherTrafficQuality(params: {
  startDate: string
  endDate: string
  zoneId?: string
}) {
  return apiFetch<TrafficQualityResponse>(
    `/api/v1/publisher/traffic-quality${toQueryString(params)}`
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
  destinationUrl?: string
  notes?: string
  adFormat?: CampaignAdFormat
  pricingModel?: CampaignPricingModel
  countryPricing?: Record<string, number>
  locations?: CampaignLocation[]
  budgetUnlimited?: boolean
  startMode?: CampaignStartMode
  scheduledAt?: string
}

// Uploads the creative file itself and returns a public URL — use the
// result to fill CreateCampaignInput.creativeUrl instead of requiring the
// advertiser to host the image elsewhere first.
export function uploadCreativeFile(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  return apiFetch<{ url: string }>("/api/v1/advertiser/creatives/upload", {
    method: "POST",
    body: formData,
  })
}

export type AdFormatRate = { cpm: number; cpa: number; cpc: number }
export type AdFormatPricing = Record<string, AdFormatRate>

// Admin-editable rate card for every ad format - see the "Pricing" tab of
// the admin dashboard. Any authenticated role can read it; only admins can
// write it (adminUpdateAdFormatPricing below).
export function getAdFormatPricing() {
  return apiFetch<AdFormatPricing>("/api/v1/config/ad-format-pricing")
}

export function createCampaign(input: CreateCampaignInput) {
  return apiFetch<{ message: string; campaign: Campaign }>(
    "/api/v1/advertiser/campaigns",
    { method: "POST", body: JSON.stringify(input) }
  )
}

// Autosaved "New Campaign" wizard draft - see campaign-wizard.tsx. Restorable
// from any device/browser since it's backend-persisted rather than kept in
// localStorage; survives a refresh, a closed tab, or a dropped connection.
export function getCampaignDraft() {
  return apiFetch<{ draft: Record<string, unknown> | null; updatedAt?: string }>(
    "/api/v1/advertiser/campaigns/draft"
  )
}

export function saveCampaignDraft(data: Record<string, unknown>) {
  return apiFetch<{ updatedAt: string }>("/api/v1/advertiser/campaigns/draft", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export function deleteCampaignDraft() {
  return apiFetch<{ message: string }>("/api/v1/advertiser/campaigns/draft", {
    method: "DELETE",
  })
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

// Countries the network actually has publisher supply in - see
// AdvertiserService.getAvailableCountries. `null` means "no restriction
// yet" (no site has declared a country), so the campaign wizard should show
// its full static country list in that case.
export function getAvailableCountries() {
  return apiFetch<{ countries: string[] | null }>(
    "/api/v1/advertiser/campaigns/meta/available-countries"
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

// --- Notifications ---

export function listNotifications(params?: { page?: number; pageSize?: number }) {
  return apiFetch<NotificationsResponse>(
    `/api/v1/notifications${toQueryString(params ?? {})}`
  )
}

export function markNotificationRead(id: string) {
  return apiFetch<Notification>(`/api/v1/notifications/${id}/read`, {
    method: "PATCH",
  })
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>("/api/v1/notifications/read-all", {
    method: "PATCH",
  })
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

// --- PayPal top-ups ---
// Advertiser "Add funds" flow: create an order, render PayPal Buttons for
// it, then have the backend capture the result once the buyer approves.
// Wallet crediting only ever happens server-side once PayPal confirms the
// capture (see backend/src/payments) - nothing here ever tells the backend
// "credit me $X" directly. Every order is priced in USD; PayPal shows
// non-US buyers (including Indian ones) a local-currency estimate on its
// own side.

export type CreatePayPalOrderResult = {
  paymentOrderId: string
  paypalOrderId: string
  paypalClientId: string
  creditAmountUsd: string
  // 18% GST added on top for an Indian account (User.country === "IN") -
  // null for everyone else. Included in payAmount, never in
  // creditAmountUsd - the wallet is only ever credited what was asked for.
  gstAmountUsd: string | null
  payAmount: string
  currency: "USD"
}

export function createPayPalOrder(input: { amountUsd: number }) {
  return apiFetch<CreatePayPalOrderResult>("/api/v1/payments/paypal/order", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function capturePayPalPayment(input: { paypalOrderId: string }) {
  return apiFetch<{ status: "PAID" }>("/api/v1/payments/paypal/capture", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// --- Razorpay top-ups ---
// The other advertiser "Add funds" option alongside PayPal above: create an
// order, open Razorpay Checkout for it, then have the backend verify the
// signature Checkout hands back. Wallet crediting only ever happens
// server-side once that signature (or the webhook) confirms payment - see
// backend/src/payments.

export type CreateRazorpayOrderResult = {
  paymentOrderId: string
  razorpayOrderId: string
  razorpayKeyId: string
  amount: number
  currency: "INR" | "USD"
  creditAmountUsd: string
  gstAmountUsd: string | null
  payAmount: string
}

export function createRazorpayOrder(input: {
  amountUsd: number
  payCurrency: "INR" | "USD"
}) {
  return apiFetch<CreateRazorpayOrderResult>("/api/v1/payments/razorpay/order", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function verifyRazorpayPayment(input: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}) {
  return apiFetch<{ status: "PAID" }>("/api/v1/payments/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// --- Publisher payout destination ---

export function getBeneficiaryAccount() {
  return apiFetch<BeneficiaryAccount | null>("/api/v1/wallet/beneficiary")
}

export function setBeneficiaryAccount(input: SetBeneficiaryAccountInput) {
  return apiFetch<BeneficiaryAccount>("/api/v1/wallet/beneficiary", {
    method: "POST",
    body: JSON.stringify(input),
  })
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

export function getAdvertiserTrafficQuality(params: {
  startDate: string
  endDate: string
  campaignId?: string
}) {
  return apiFetch<TrafficQualityResponse>(
    `/api/v1/advertiser/traffic-quality${toQueryString(params)}`
  )
}

// --- Admin: revenue ---

export function adminGetRevenueSummary() {
  return apiFetch<RevenueSummary>("/api/v1/admin/revenue/summary")
}

export function adminGetRevenueBreakdown() {
  return apiFetch<RevenueBreakdown>("/api/v1/admin/revenue/breakdown")
}

// --- Admin: ad format pricing ---

export function adminGetAdFormatPricing() {
  return apiFetch<AdFormatPricing>("/api/v1/admin/settings/ad-format-pricing")
}

export function adminUpdateAdFormatPricing(
  adFormat: string,
  rate: AdFormatRate
) {
  return apiFetch<AdFormatPricing>(
    "/api/v1/admin/settings/ad-format-pricing",
    { method: "PATCH", body: JSON.stringify({ adFormat, ...rate }) }
  )
}

// --- Admin: minimum advertiser wallet balance ---
// Floor an advertiser's free wallet balance must stay above of - see
// PlatformSetting.minAdvertiserBalanceUsd in the backend schema.

export function adminGetMinAdvertiserBalance() {
  return apiFetch<{ minAdvertiserBalanceUsd: string }>(
    "/api/v1/admin/settings/min-advertiser-balance"
  )
}

export function adminUpdateMinAdvertiserBalance(
  minAdvertiserBalanceUsd: number
) {
  return apiFetch<{ minAdvertiserBalanceUsd: string }>(
    "/api/v1/admin/settings/min-advertiser-balance",
    { method: "PATCH", body: JSON.stringify({ minAdvertiserBalanceUsd }) }
  )
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

export function adminListAdvertisers(params?: {
  page?: number
  pageSize?: number
  search?: string
}) {
  return apiFetch<Paginated<AdminAdvertiserSummary, "advertisers">>(
    `/api/v1/admin/advertisers${toQueryString(params ?? {})}`
  )
}

export function adminGetAdvertiser(
  advertiserId: string,
  params?: { startDate?: string; endDate?: string }
) {
  return apiFetch<AdminAdvertiserDetail>(
    `/api/v1/admin/advertisers/${advertiserId}${toQueryString(params ?? {})}`
  )
}

export function adminListPublishers(params?: {
  page?: number
  pageSize?: number
  search?: string
}) {
  return apiFetch<Paginated<AdminPublisherSummary, "publishers">>(
    `/api/v1/admin/publishers${toQueryString(params ?? {})}`
  )
}

export function adminGetPublisher(
  publisherId: string,
  params?: { startDate?: string; endDate?: string }
) {
  return apiFetch<AdminPublisherDetail>(
    `/api/v1/admin/publishers/${publisherId}${toQueryString(params ?? {})}`
  )
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

// --- Admin: traffic quality / fraud protection ---

export function adminGetTrafficQuality(params: {
  startDate: string
  endDate: string
}) {
  return apiFetch<TrafficQualityResponse>(
    `/api/v1/admin/traffic-quality${toQueryString(params)}`
  )
}

export function adminListBlacklistedIps(params?: {
  page?: number
  pageSize?: number
}) {
  return apiFetch<Paginated<BlacklistedIp, "ips">>(
    `/api/v1/admin/blacklist${toQueryString(params ?? {})}`
  )
}

export function adminAddBlacklistedIp(input: {
  ipAddress: string
  reason: string
}) {
  return apiFetch<BlacklistedIp>("/api/v1/admin/blacklist", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function adminRemoveBlacklistedIp(id: string) {
  return apiFetch<{ removed: boolean }>(`/api/v1/admin/blacklist/${id}`, {
    method: "DELETE",
  })
}

// --- Analytics ---

export function getDailyAnalytics(startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate })
  return apiFetch<AnalyticsResponse>(
    `/api/v1/analytics/daily?${params.toString()}`
  )
}
