"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AddCircleIcon,
  Chart01Icon,
  CheckListIcon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CrownIcon,
  DashboardSquare01Icon,
  HelpCircleIcon,
  Mail01Icon,
  Megaphone01Icon,
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
  // Rendered as a filled gradient pill instead of a plain link - used for
  // the "New Campaign" shortcut so it reads as a primary action, matching
  // the reference AdsBender dashboard design.
  emphasize?: boolean
}

type GroupItem = {
  label: string
  icon: IconSvgElement
  children: LeafItem[]
}

const NAV: (LeafItem | GroupItem)[] = [
  { href: "/advertiser", label: "Dashboard", icon: DashboardSquare01Icon },
  {
    label: "Campaigns",
    icon: Megaphone01Icon,
    children: [
      { href: "/advertiser/campaigns", label: "My Campaigns", icon: CheckListIcon },
      {
        href: "/advertiser/campaigns?tab=new",
        label: "New Campaign",
        icon: AddCircleIcon,
        emphasize: true,
      },
    ],
  },
  { href: "/advertiser/wallet", label: "Add Funds", icon: Wallet01Icon },
  // Shared with the global AppSidebar (see app-shell.tsx) - kept here too
  // since /advertiser/* pages render this sidebar instead of that one.
  { href: "/analytics", label: "Analytics", icon: Chart01Icon },
]

const SUPPORT_LINKS: LeafItem[] = [
  { href: "/faq", label: "Help Center", icon: HelpCircleIcon },
  { href: "/contact", label: "Contact Us", icon: Mail01Icon },
]

function isGroup(item: LeafItem | GroupItem): item is GroupItem {
  return "children" in item
}

// Base-path match: "/advertiser/campaigns?tab=new" is active on both
// campaign tabs, so we compare pathname only and let the query string
// (used just to preselect a tab) ride along separately.
function hrefPath(href: string) {
  return href.split("?")[0]
}

function isNewCampaignActive(pathname: string, search: string) {
  return pathname === "/advertiser/campaigns" && search.includes("tab=new")
}

// Shared between the desktop <aside> and the mobile drawer (MobileSidebarNav)
// so both stay in sync off one nav tree and one open/active rule.
export function AdvertiserSidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const pathname = usePathname()
  const search =
    typeof window !== "undefined" ? window.location.search : ""
  const [open, setOpen] = React.useState(true)

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) =>
        isGroup(item) ? (
          <div key={item.label} className="flex flex-col">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground",
                item.children.some((c) => pathname === hrefPath(c.href)) &&
                  "bg-violet-50 text-violet-700"
              )}
            >
              <HIcon icon={item.icon} className="size-4 shrink-0" />
              {!collapsed ? (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  <HIcon
                    icon={ChevronDownIcon}
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </>
              ) : null}
            </button>
            {open && !collapsed ? (
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l pl-3">
                {item.children.map((child) => {
                  const active = child.emphasize
                    ? isNewCampaignActive(pathname, search)
                    : pathname === hrefPath(child.href)
                  if (child.emphasize) {
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90",
                          active
                            ? "sidebar-pill-gradient"
                            : "sidebar-pill-gradient opacity-80 hover:opacity-100"
                        )}
                      >
                        <HIcon icon={child.icon} className="size-3.5 shrink-0" />
                        {child.label}
                      </Link>
                    )
                  }
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground",
                        active && "bg-violet-50 font-medium text-violet-700"
                      )}
                    >
                      <HIcon icon={child.icon} className="size-3.5 shrink-0" />
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground",
              pathname === hrefPath(item.href) &&
                "sidebar-pill-gradient text-white hover:opacity-90"
            )}
          >
            <HIcon icon={item.icon} className="size-4 shrink-0" />
            {!collapsed ? item.label : null}
          </Link>
        )
      )}

      {!collapsed ? (
        <p className="mt-5 px-3 pb-1 text-xs font-semibold tracking-wide font-medium text-foreground/75/60 uppercase">
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
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground"
        >
          <HIcon icon={link.icon} className="size-4 shrink-0" />
          {!collapsed ? link.label : null}
        </Link>
      ))}
    </nav>
  )
}

export function AdvertiserSidebar() {
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-white md:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <Link
        href="/advertiser"
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
        <AdvertiserSidebarNav collapsed={collapsed} />
      </div>

      {!collapsed ? (
        <div className="mx-3 mb-3 rounded-2xl border bg-muted/30 p-4 text-center shadow-sm">
          <span className="sidebar-pill-gradient mx-auto flex size-9 items-center justify-center rounded-full text-white">
            <HIcon icon={CrownIcon} className="size-4" />
          </span>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Upgrade your campaigns
          </p>
          <p className="mt-0.5 text-xs font-medium text-foreground/75">
            Get more reach, better results.
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
        className="flex items-center gap-2 border-t px-4 py-3 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground"
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
