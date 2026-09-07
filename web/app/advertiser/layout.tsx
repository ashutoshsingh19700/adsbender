import type { Metadata } from "next"

import { RequireRole } from "@/components/app/require-role"
import { AdvertiserSidebar } from "@/components/app/advertiser-sidebar"
import { AdvertiserTopbar } from "@/components/app/advertiser-topbar"

// Authenticated account area — never a search result. robots.ts also
// disallows crawling this prefix; this noindex is the belt to that
// suspenders (covers the case a link to it leaks in from elsewhere).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Shared shell for every /advertiser/* page: role gate + the persistent
// sidebar (Dashboard, Statistics, Campaigns, Add Funds). Individual pages
// only render their own content area.
export default function AdvertiserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireRole roles={["ADVERTISER"]}>
      <div className="flex">
        <AdvertiserSidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-[#f7f6fb]">
          <AdvertiserTopbar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </RequireRole>
  )
}
