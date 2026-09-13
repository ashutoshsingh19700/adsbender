import { RequireRole } from "@/components/app/require-role"

import { AdvertisersPanel } from "./advertisers-panel"

export default function AdminAdvertisersPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Advertisers
          </h1>
          <p className="text-muted-foreground">
            Every advertiser account: spend, campaigns, and where their ads
            reach around the world.
          </p>
        </div>
        <AdvertisersPanel />
      </div>
    </RequireRole>
  )
}
