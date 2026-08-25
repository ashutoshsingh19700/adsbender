"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Megaphone,
  PlusCircle,
  Wallet,
} from "lucide-react"

import { cn } from "@/lib/utils"

type LeafItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type GroupItem = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: LeafItem[]
}

const NAV: (LeafItem | GroupItem)[] = [
  { href: "/advertiser", label: "Dashboard", icon: LayoutDashboard },
  { href: "/advertiser/statistics", label: "Statistics", icon: LineChart },
  {
    label: "Campaigns",
    icon: Megaphone,
    children: [
      { href: "/advertiser/campaigns", label: "My Campaigns", icon: ListChecks },
      {
        href: "/advertiser/campaigns?tab=new",
        label: "New Campaign",
        icon: PlusCircle,
      },
    ],
  },
  { href: "/advertiser/wallet", label: "Add Funds", icon: Wallet },
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

export function AdvertiserSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(true)

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-muted/30 md:block">
      <nav className="sticky top-20 flex flex-col gap-1 p-4">
        {NAV.map((item) =>
          isGroup(item) ? (
            <div key={item.label} className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/30",
                  item.children.some((c) => pathname === hrefPath(c.href)) &&
                    "bg-orange-50 text-orange-600 dark:bg-orange-950/30"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform",
                    open && "rotate-180"
                  )}
                />
              </button>
              {open ? (
                <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l pl-3">
                  {item.children.map((child) => {
                    const active = pathname === hrefPath(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/30",
                          active &&
                            "bg-orange-50 font-medium text-orange-600 dark:bg-orange-950/30"
                        )}
                      >
                        <child.icon className="size-3.5 shrink-0" />
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
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/30",
                pathname === hrefPath(item.href) &&
                  "bg-orange-500 text-white hover:bg-orange-500 hover:text-white"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        )}
      </nav>
    </aside>
  )
}
