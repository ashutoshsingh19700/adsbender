"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import { BARE_CHROME_PATHS } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AppSidebarNav } from "@/components/app/app-sidebar"
import { AdvertiserSidebarNav } from "@/components/app/advertiser-sidebar"

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

  const isAdvertiser = pathname === "/advertiser" || pathname.startsWith("/advertiser/")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        {isAdvertiser ? (
          <AdvertiserSidebarNav onNavigate={() => setOpen(false)} />
        ) : (
          <AppSidebarNav onNavigate={() => setOpen(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}
