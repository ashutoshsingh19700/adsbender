"use client"

import { useAuth } from "@/app/providers/auth-provider"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AdvertiserSidebar } from "@/components/app/advertiser-sidebar"
import { AdvertiserTopbar } from "@/components/app/advertiser-topbar"
import { PublisherSidebar } from "@/components/app/publisher-sidebar"
import { PublisherTopbar } from "@/components/app/publisher-topbar"

// /analytics is shared across ADVERTISER, PUBLISHER and ADMIN - unlike
// /advertiser/* and /publisher/*, it has no single role-specific layout of
// its own, so it used to fall through to AppShell's generic AppSidebar for
// everyone (a different look than the rest of each role's dashboard). This
// picks the matching sidebar + topbar per role instead, so Analytics reads
// as part of the same dashboard it's linked from rather than a separate,
// differently-styled page.
export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()

  if (user?.role === "PUBLISHER") {
    return (
      <div className="flex">
        <PublisherSidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-[#f7f6fb]">
          <PublisherTopbar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    )
  }

  if (user?.role === "ADVERTISER") {
    return (
      <div className="flex">
        <AdvertiserSidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-[#f7f6fb]">
          <AdvertiserTopbar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    )
  }

  // ADMIN (and the brief instant before `user` loads) - no redesigned admin
  // shell exists yet, so this keeps the previous generic sidebar behavior.
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-start gap-6 px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
      <AppSidebar />
      <main className="min-w-0 flex-1 pt-6">{children}</main>
    </div>
  )
}
