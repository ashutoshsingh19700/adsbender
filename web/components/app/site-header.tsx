"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { ROLE_HOME } from "@/lib/roles"
import type { UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MarketingNav } from "@/components/app/marketing-nav"
import { SignUpDialog } from "@/components/app/signup-dialog"

// Each entry is only ever shown to the roles listed — a signed-out visitor,
// or a signed-in user viewing another role's link, never sees it. This is
// what keeps wallet/earnings/admin surfaces out of the global nav.
const NAV_LINKS: { href: string; label: string; roles: UserRole[] }[] = [
  { href: "/publisher", label: "Publisher Portal", roles: ["PUBLISHER"] },
  { href: "/publisher/earnings", label: "Earnings", roles: ["PUBLISHER"] },
  { href: "/advertiser", label: "Advertiser Studio", roles: ["ADVERTISER"] },
  { href: "/advertiser/wallet", label: "Wallet", roles: ["ADVERTISER"] },
  { href: "/analytics", label: "Analytics", roles: ["ADVERTISER", "PUBLISHER", "ADMIN"] },
  { href: "/admin", label: "Admin", roles: ["ADMIN"] },
]

export function SiteHeader() {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push("/")
    router.refresh()
  }

  const visibleLinks = user
    ? NAV_LINKS.filter((link) => link.roles.includes(user.role))
    : []

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href={user ? ROLE_HOME[user.role] : "/"}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-orange-500 text-xs font-bold text-white">
            A
          </span>
          AdsBender
        </Link>

        {user ? (
          <nav className="hidden items-center gap-1 md:flex">
            {visibleLinks.map((link) => (
              <Button
                key={link.href}
                asChild
                variant={pathname === link.href ? "secondary" : "ghost"}
                size="sm"
              >
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </nav>
        ) : (
          <MarketingNav />
        )}

        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <Badge variant="outline">{user.role}</Badge>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <SignUpDialog />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
