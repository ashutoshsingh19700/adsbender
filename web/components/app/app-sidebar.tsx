"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Globe2,
  LayoutDashboard,
  LineChart,
  Shield,
  Wallet,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import type { UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"

type SidebarLink = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  // Sidebar entries highlight for their own path plus everything nested
  // under it (e.g. "/publisher/websites/123" should still light up
  // "Websites") - exact-match links (the role home) opt out of that.
  exactMatch?: boolean
}

// Same destinations the old top nav (site-header.tsx) exposed, just
// regrouped as a left sidebar per role - mirrors the "PLATFORM" section
// pattern from the Adsterra publisher dashboard reference.
const LINKS: SidebarLink[] = [
  { href: "/publisher", label: "Publisher Portal", icon: LayoutDashboard, roles: ["PUBLISHER"], exactMatch: true },
  { href: "/publisher/websites", label: "Websites", icon: Globe2, roles: ["PUBLISHER"] },
  { href: "/publisher/statistics", label: "Statistics", icon: BarChart3, roles: ["PUBLISHER"] },
  { href: "/publisher/earnings", label: "Earnings", icon: Wallet, roles: ["PUBLISHER"] },
  { href: "/advertiser", label: "Advertiser Studio", icon: LayoutDashboard, roles: ["ADVERTISER"], exactMatch: true },
  { href: "/advertiser/wallet", label: "Wallet", icon: Wallet, roles: ["ADVERTISER"] },
  { href: "/admin", label: "Admin", icon: Shield, roles: ["ADMIN"], exactMatch: true },
  { href: "/analytics", label: "Analytics", icon: LineChart, roles: ["ADVERTISER", "PUBLISHER", "ADMIN"] },
]

export function AppSidebar() {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const links = LINKS.filter((link) => link.roles.includes(user.role))

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-56 shrink-0 border-r bg-background md:block">
      <nav className="flex h-full flex-col gap-0.5 overflow-y-auto px-3 py-5">
        <p className="px-2.5 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Platform
        </p>
        {links.map((link) => {
          const active = link.exactMatch
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`)
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
