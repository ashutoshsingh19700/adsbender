"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChartIcon,
  Chart01Icon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CrownIcon,
  DashboardSquare01Icon,
  GlobeIcon,
  HelpCircleIcon,
  Mail01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/app/logo"
import { HIcon } from "@/components/app/h-icon"

type LeafItem = {
  href: string
  label: string
  icon: IconSvgElement
  exactMatch?: boolean
}

const NAV: LeafItem[] = [
  { href: "/publisher", label: "Dashboard", icon: DashboardSquare01Icon, exactMatch: true },
  { href: "/publisher/websites", label: "Websites", icon: GlobeIcon },
  { href: "/publisher/statistics", label: "Statistics", icon: BarChartIcon },
  { href: "/publisher/earnings", label: "Earnings", icon: Wallet01Icon },
  { href: "/analytics", label: "Analytics", icon: Chart01Icon },
]

const SUPPORT_LINKS: LeafItem[] = [
  { href: "/faq", label: "Help Center", icon: HelpCircleIcon },
  { href: "/contact", label: "Contact Us", icon: Mail01Icon },
]

// Light shell, same as AdvertiserSidebar (see advertiser-sidebar.tsx) so the
// two dashboards read as one product instead of two different sites - only
// the nav destinations differ per role.
export function PublisherSidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = item.exactMatch
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "sidebar-pill-gradient text-white hover:opacity-90"
            )}
          >
            <HIcon icon={item.icon} className="size-4 shrink-0" />
            {!collapsed ? item.label : null}
          </Link>
        )
      })}

      {!collapsed ? (
        <p className="mt-5 px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground/60 uppercase">
          Support
        </p>
      ) : (
        <div className="my-4 h-px bg-border" />
      )}
      {SUPPORT_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          title={collapsed ? link.label : undefined}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HIcon icon={link.icon} className="size-4 shrink-0" />
          {!collapsed ? link.label : null}
        </Link>
      ))}
    </nav>
  )
}

export function PublisherSidebar() {
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-white md:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <Link
        href="/publisher"
        className="flex items-center gap-2.5 border-b px-4 py-5 text-lg font-semibold tracking-tight"
      >
        {collapsed ? (
          <span className="sidebar-pill-gradient flex size-9 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-fuchsia-900/30">
            <span className="block size-3.5 rotate-45 rounded-[3px] bg-white" />
          </span>
        ) : (
          <Logo className="h-9" />
        )}
      </Link>

      <div className="flex-1 overflow-y-auto">
        <PublisherSidebarNav collapsed={collapsed} />
      </div>

      {!collapsed ? (
        <div className="mx-3 mb-3 rounded-2xl border bg-muted/30 p-4 text-center shadow-sm">
          <span className="sidebar-pill-gradient mx-auto flex size-9 items-center justify-center rounded-full text-white">
            <HIcon icon={CrownIcon} className="size-4" />
          </span>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Grow your earnings
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add more zones, reach more advertisers.
          </p>
          <Button
            size="sm"
            className="sidebar-pill-gradient mt-3 w-full rounded-full text-white hover:opacity-90"
          >
            Learn more
          </Button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 border-t px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {collapsed ? (
          <HIcon icon={ChevronsRightIcon} className="size-4 shrink-0" />
        ) : (
          <>
            <HIcon icon={ChevronsLeftIcon} className="size-4 shrink-0" />
            Collapse
          </>
        )}
      </button>
    </aside>
  )
}
