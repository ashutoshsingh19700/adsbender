"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Menu01Icon } from "@hugeicons/core-free-icons"

import { useAuth } from "@/app/providers/auth-provider"
import { BARE_CHROME_PATHS } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { HIcon } from "@/components/app/h-icon"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AppSidebarNav } from "@/components/app/app-sidebar"
import { AdvertiserSidebarNav } from "@/components/app/advertiser-sidebar"
import { PublisherSidebarNav } from "@/components/app/publisher-sidebar"
import { SidebarAccountFooter } from "@/components/app/sidebar-account-footer"

// Below md, both AppSidebar and AdvertiserSidebar render nothing (they're
// `hidden md:block`) — this is the phone/tablet stand-in: a hamburger button
// in the header that opens the same nav links in a slide-over drawer. Lives
// in the header (rendered for every route) rather than in AppShell/the
// advertiser layout so there's exactly one trigger, and it self-hides on
// routes with no sidebar at all (signed out, bare-chrome, or no sidebar
// section) instead of duplicating that routing logic per-shell.
export function MobileSidebarTrigger() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  if (!user || BARE_CHROME_PATHS.includes(pathname)) return null

  // /analytics is shared across roles (see app/analytics/layout.tsx) - the
  // drawer's nav for it follows the signed-in user's role the same way that
  // layout does, so it matches whichever sidebar desktop is showing there.
  const onAnalytics = pathname === "/analytics"
  const isAdvertiser =
    pathname === "/advertiser" ||
    pathname.startsWith("/advertiser/") ||
    (onAnalytics && user.role === "ADVERTISER")
  const isPublisher =
    pathname === "/publisher" ||
    pathname.startsWith("/publisher/") ||
    (onAnalytics && user.role === "PUBLISHER")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <HIcon icon={Menu01Icon} className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {isAdvertiser ? (
            <AdvertiserSidebarNav onNavigate={() => setOpen(false)} />
          ) : isPublisher ? (
            <PublisherSidebarNav onNavigate={() => setOpen(false)} />
          ) : (
            <AppSidebarNav onNavigate={() => setOpen(false)} />
          )}
        </div>
        {!isAdvertiser && !isPublisher ? <SidebarAccountFooter /> : null}
      </SheetContent>
    </Sheet>
  )
}
