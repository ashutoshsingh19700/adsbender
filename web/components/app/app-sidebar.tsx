"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Globe2,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Shield,
  Users2,
  Wallet,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import type { UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ROLE_HOME } from "@/lib/roles"
import { Logo } from "@/components/app/logo"
import { SidebarAccountFooter } from "@/components/app/sidebar-account-footer"

type SidebarLink = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  // Sidebar entries highlight for their own path plus everything nested
  // under it (e.g. "/publisher/websites/123" should still light up
  // "Websites") - exact-match links (the role home) opt out of that.
  exactMatch?: boolean
  // Further restricts an ADMIN-role link to specific admin scopes, mirroring
  // AdminController's @AdminScopes guards (see admin-dashboard.tsx for the
  // same MASTER/PUBLISHER/ADVERTISER tab-visibility rule) - a scoped admin
  // hitting a link they can't use would just get a 403 from the API.
  // Omitted (or the link's roles don't include "ADMIN") means unrestricted.
  adminScopes?: ("MASTER" | "PUBLISHER" | "ADVERTISER")[]
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
  { href: "/admin/advertisers", label: "Advertisers", icon: Megaphone, roles: ["ADMIN"], adminScopes: ["MASTER", "ADVERTISER"] },
  { href: "/admin/publishers", label: "Publishers", icon: Users2, roles: ["ADMIN"], adminScopes: ["MASTER", "PUBLISHER"] },
  { href: "/analytics", label: "Analytics", icon: LineChart, roles: ["ADVERTISER", "PUBLISHER", "ADMIN"] },
]

// Shared between the desktop <aside> and the mobile drawer (MobileSidebarNav)
// so both stay in sync off one link list and one "what's active" rule.
export function AppSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // A legacy admin with no adminScope set is unrestricted, same as the
  // backend's AdminScopeGuard MASTER bypass (see admin-dashboard.tsx).
  const scope = user?.adminScope ?? "MASTER"
  const links = user
    ? LINKS.filter(
        (link) =>
          link.roles.includes(user.role) &&
          (!link.adminScopes || link.adminScopes.includes(scope))
      )
    : []

  // The current page is already loaded - warm the router cache for every
  // OTHER link this sidebar shows while the user reads/works on this one,
  // so switching sections later feels instant instead of triggering a fresh
  // fetch + render. Deferred with a short timeout (rather than firing
  // immediately on mount) so it never competes with the current page's own
  // data requests for bandwidth/main-thread time.
  const linkHrefs = links.map((l) => l.href).join(",")
  React.useEffect(() => {
    if (!linkHrefs) return
    const timer = setTimeout(() => {
      for (const href of linkHrefs.split(",")) {
        if (href !== pathname) router.prefetch(href)
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [linkHrefs, pathname, router])

  if (!user) return null

  return (
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
            onClick={onNavigate}
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
  )
}

export function AppSidebar() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-background md:flex">
      <Link
        href={ROLE_HOME[user.role]}
        className="flex items-center gap-2 border-b px-4 py-4 text-lg font-semibold tracking-tight"
      >
        <Logo className="h-8" />
        <span className="sr-only">AdsBender</span>
      </Link>
      <div className="flex-1 overflow-y-auto">
        <AppSidebarNav />
      </div>
      <SidebarAccountFooter />
    </aside>
  )
}
