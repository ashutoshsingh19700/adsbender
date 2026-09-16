"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

import { CampaignManager } from "../campaign-manager"
import { CampaignWizard } from "../campaign-wizard"

export function CampaignsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "new" ? "new" : "campaigns"

  const [tab, setTab] = React.useState(initialTab)
  // Bumped whenever a campaign is created so <CampaignManager> re-fetches.
  const [listVersion, setListVersion] = React.useState(0)

  // The sidebar's "New Campaign" link routes here with ?tab=new; keep the
  // tab in sync if that param changes after the page has already mounted.
  React.useEffect(() => {
    setTab(searchParams.get("tab") === "new" ? "new" : "campaigns")
  }, [searchParams])

  function openWizard() {
    setTab("new")
    router.replace("/advertiser/campaigns?tab=new")
  }

  return (
    <div className="space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      {tab === "new" ? null : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
            <p className="font-medium text-foreground/75">
              Manage your campaigns or submit a new one.
            </p>
          </div>
          <Button
            onClick={openWizard}
            className="brand-gradient btn-shine gap-2 rounded-xl border-0 font-semibold text-white shadow-sm shadow-fuchsia-900/10"
          >
            <Plus className="size-4" />
            New Campaign
          </Button>
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value)
          router.replace(
            value === "new" ? "/advertiser/campaigns?tab=new" : "/advertiser/campaigns"
          )
        }}
      >
        <TabsContent value="campaigns" className="space-y-4 pt-2">
          <CampaignManager refreshToken={listVersion} />
        </TabsContent>

        <TabsContent value="new" className="pt-2">
          <CampaignWizard
            onCreated={() => {
              setListVersion((v) => v + 1)
              setTab("campaigns")
              router.replace("/advertiser/campaigns")
            }}
            onCancel={() => {
              setTab("campaigns")
              router.replace("/advertiser/campaigns")
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
