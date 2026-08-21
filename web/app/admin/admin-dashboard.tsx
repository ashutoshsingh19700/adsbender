"use client"

import * as React from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AdminOverview } from "./admin-overview"
import { CampaignReviewPanel } from "./campaign-review-panel"
import { PayoutsPanel } from "./payouts-panel"
import { RevenuePanel } from "./revenue-panel"
import { SitesPanel } from "./sites-panel"
import { UsersPanel } from "./users-panel"

export function AdminDashboard() {
  // Bumped whenever a campaign is approved/rejected so <AdminOverview>'s
  // status counts stay in sync without a manual refresh.
  const [overviewToken, setOverviewToken] = React.useState(0)

  return (
    <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Admin Console
        </h1>
        <p className="text-muted-foreground">
          Review campaigns, process payouts, and oversee accounts.
        </p>
      </div>

      <AdminOverview refreshToken={overviewToken} />

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaign Review</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="pt-4">
          <CampaignReviewPanel
            onCampaignReviewed={() => setOverviewToken((v) => v + 1)}
          />
        </TabsContent>
        <TabsContent value="revenue" className="pt-4">
          <RevenuePanel />
        </TabsContent>
        <TabsContent value="payouts" className="pt-4">
          <PayoutsPanel />
        </TabsContent>
        <TabsContent value="users" className="pt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="sites" className="pt-4">
          <SitesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
