"use client"

import { useAuth } from "@/app/providers/auth-provider"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AdvertiserSidebar } from "@/components/app/advertiser-sidebar"
import { AdvertiserTopbar } from "@/components/app/advertiser-topbar"
import { PublisherSidebar } from "@/components/app/publisher-sidebar"
import { PublisherTopbar } from "@/components/app/publisher-topbar"

// Shared by every page that's reachable from more than one role's sidebar
// (Analytics, Help Center, Contact Us, ...) - picks the same sidebar +
// topbar that role's own dashboard uses, so clicking through from e.g. the
// Publisher Portal doesn't land on a page that suddenly looks like a
// different, unstyled product. See app/analytics/layout.tsx for the
// original version of this logic.
export function RoleAwareShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (user?.role === "PUBLISHER") {
    return (
      <div className="flex">
        <PublisherSidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-white">
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
        <div className="flex min-w-0 flex-1 flex-col bg-white">
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
