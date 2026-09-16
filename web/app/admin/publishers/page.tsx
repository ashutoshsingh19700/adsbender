import { RequireRole } from "@/components/app/require-role"

import { PublishersPanel } from "./publishers-panel"

export default function AdminPublishersPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8 py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Publishers
          </h1>
          <p className="font-medium text-foreground/75">
            Every publisher account: payouts, sites, and where their traffic
            is coming from.
          </p>
        </div>
        <PublishersPanel />
      </div>
    </RequireRole>
  )
}
