"use client"

import * as React from "react"

import { RequireRole } from "@/components/app/require-role"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AdvertiserOverview } from "./advertiser-overview"
import { CampaignManager } from "./campaign-manager"
import { CampaignWizard } from "./campaign-wizard"

export default function AdvertiserPage() {
  const [tab, setTab] = React.useState("campaigns")
  // Bumped whenever a campaign is created so <CampaignManager> re-fetches.
  const [listVersion, setListVersion] = React.useState(0)

  return (
    <RequireRole roles={["ADVERTISER"]}>
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Advertiser Studio
          </h1>
          <p className="text-muted-foreground">
            Manage your campaigns or submit a new one.
          </p>
        </div>

        <AdvertiserOverview refreshToken={listVersion} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="campaigns">My Campaigns</TabsTrigger>
            <TabsTrigger value="new">New Campaign</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-4 pt-2">
            <CampaignManager refreshToken={listVersion} />
          </TabsContent>

          <TabsContent value="new" className="pt-2">
            <CampaignWizard
              onCreated={() => {
                setListVersion((v) => v + 1)
                setTab("campaigns")
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RequireRole>
  )
}
