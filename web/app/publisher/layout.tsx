import type { Metadata } from "next"

import { RequireRole } from "@/components/app/require-role"
import { PublisherSidebar } from "@/components/app/publisher-sidebar"
import { PublisherTopbar } from "@/components/app/publisher-topbar"

// Authenticated account area — never a search result. robots.ts also
// disallows crawling this prefix; this noindex is the belt to that
// suspenders (covers the case a link to it leaks in from elsewhere).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Shared shell for every /publisher/* page: role gate + the persistent
// sidebar (Dashboard, Websites, Statistics, Earnings, Analytics). Mirrors
// AdvertiserLayout (see app/advertiser/layout.tsx) so both dashboards share
// one look instead of reading as two different products.
export default function PublisherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireRole roles={["PUBLISHER"]}>
      <div className="flex">
        <PublisherSidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-[#f7f6fb]">
          <PublisherTopbar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </RequireRole>
  )
}
