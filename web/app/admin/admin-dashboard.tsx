"use client"

import * as React from "react"

import { useAuth } from "@/app/providers/auth-provider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AdminOverview } from "./admin-overview"
import { BlacklistPanel } from "./blacklist-panel"
import { CampaignReviewPanel } from "./campaign-review-panel"
import { MoneyFlowPanel } from "./money-flow-panel"
import { PayoutsPanel } from "./payouts-panel"
import { PricingPanel } from "./pricing-panel"
import { RevenuePanel } from "./revenue-panel"
import { SitesPanel } from "./sites-panel"
import { AdminTrafficQualityPanel } from "./traffic-quality-panel"
import { UsersPanel } from "./users-panel"

const SCOPE_LABEL: Record<string, string> = {
  MASTER: "Master Admin",
  PUBLISHER: "Publisher Admin",
  ADVERTISER: "Advertiser Admin",
}

export function AdminDashboard() {
  const { user } = useAuth()
  // A legacy admin created before scopes existed has no adminScope set at
  // all - treat that the same as MASTER (unrestricted), matching the
  // backend's AdminScopeGuard bypass.
  const scope = user?.adminScope ?? "MASTER"
  const isMaster = scope === "MASTER"
  const isPublisherAdmin = scope === "PUBLISHER"
  const isAdvertiserAdmin = scope === "ADVERTISER"

  // Bumped whenever a campaign is approved/rejected so <AdminOverview>'s
  // status counts stay in sync without a manual refresh.
  const [overviewToken, setOverviewToken] = React.useState(0)

  const defaultTab = isPublisherAdmin
    ? "sites"
    : isAdvertiserAdmin
      ? "campaigns"
      : "campaigns"

  return (
    <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Admin Console
          {!isMaster ? (
            <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
              ({SCOPE_LABEL[scope] ?? scope})
            </span>
          ) : null}
        </h1>
        <p className="text-muted-foreground">
          {isPublisherAdmin
            ? "Manage publisher sites, payouts, and publisher-side traffic quality."
            : isAdvertiserAdmin
              ? "Review campaigns and oversee advertiser accounts."
              : "Review campaigns, process payouts, and oversee accounts."}
        </p>
      </div>

      <AdminOverview refreshToken={overviewToken} scope={scope} />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {isMaster || isAdvertiserAdmin ? (
            <TabsTrigger value="campaigns">Campaign Review</TabsTrigger>
          ) : null}
          {isMaster ? (
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          ) : null}
          {isMaster ? (
            <TabsTrigger value="money-flow">Money Flow</TabsTrigger>
          ) : null}
          {isMaster ? (
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          ) : null}
          {isMaster || isPublisherAdmin ? (
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          ) : null}
          <TabsTrigger value="users">Users</TabsTrigger>
          {isMaster || isPublisherAdmin ? (
            <TabsTrigger value="sites">Sites</TabsTrigger>
          ) : null}
          <TabsTrigger value="traffic-quality">Traffic Quality</TabsTrigger>
          {isMaster || isPublisherAdmin ? (
            <TabsTrigger value="blacklist">IP Blacklist</TabsTrigger>
          ) : null}
        </TabsList>

        {isMaster || isAdvertiserAdmin ? (
          <TabsContent value="campaigns" className="pt-4">
            <CampaignReviewPanel
              onCampaignReviewed={() => setOverviewToken((v) => v + 1)}
            />
          </TabsContent>
        ) : null}
        {isMaster ? (
          <TabsContent value="revenue" className="pt-4">
            <RevenuePanel />
          </TabsContent>
        ) : null}
        {isMaster ? (
          <TabsContent value="money-flow" className="pt-4">
            <MoneyFlowPanel />
          </TabsContent>
        ) : null}
        {isMaster ? (
          <TabsContent value="pricing" className="pt-4">
            <PricingPanel />
          </TabsContent>
        ) : null}
        {isMaster || isPublisherAdmin ? (
          <TabsContent value="payouts" className="pt-4">
            <PayoutsPanel />
          </TabsContent>
        ) : null}
        <TabsContent value="users" className="pt-4">
          <UsersPanel />
        </TabsContent>
        {isMaster || isPublisherAdmin ? (
          <TabsContent value="sites" className="pt-4">
            <SitesPanel />
          </TabsContent>
        ) : null}
        <TabsContent value="traffic-quality" className="pt-4">
          <AdminTrafficQualityPanel />
        </TabsContent>
        {isMaster || isPublisherAdmin ? (
          <TabsContent value="blacklist" className="pt-4">
            <BlacklistPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
