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

  // The auth pages (login/register, forgot/reset password, either role) use
  // their own minimal bar — just the logo and a contact link, no nav or
  // auth CTAs since the user is already there.
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    return (
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-orange-500 text-sm font-bold text-white">
              A
            </span>
            AdsBender
          </Link>
          <a
            href="mailto:support@adsbender.example"
            className="text-sm font-medium tracking-wide text-muted-foreground hover:text-orange-600"
          >
            CONTACT US
          </a>
        </div>
      </header>
    )
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
        <Link
          href={user ? ROLE_HOME[user.role] : "/"}
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-orange-500 text-sm font-bold text-white">
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
              <span className="btn-halo">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="btn-shine rounded-full border-orange-300 px-6 text-orange-600 hover:bg-white hover:text-orange-600"
                >
                  <Link href="/login">Log in</Link>
                </Button>
              </span>
              <span className="btn-halo">
                <SignUpDialog />
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
