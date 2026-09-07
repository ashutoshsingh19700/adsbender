"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { BARE_CHROME_PATHS, ROLE_HOME } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SignUpDialog } from "@/components/app/signup-dialog"
import { Logo } from "@/components/app/logo"

// Signed-in nav (Websites, Statistics, Earnings, Admin, etc.) lives in the
// left sidebar now — see components/app/app-sidebar.tsx. This bar is just
// the brand mark plus the account menu for every route, signed in or not.
export function SiteHeader() {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push("/")
    router.refresh()
  }

  // The auth pages (login/register, forgot/reset password, either role) use
  // their own minimal bar — just the logo and a contact link, no nav or
  // auth CTAs since the user is already there.
  if (BARE_CHROME_PATHS.includes(pathname)) {
    return (
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
          >
            <Logo className="h-10 sm:h-14 md:h-20" />
            <span className="sr-only">AdsBender</span>
          </Link>
          <a
            href="mailto:support@adsbender.example"
            className="text-sm font-medium tracking-wide text-muted-foreground hover:text-violet-600"
          >
            CONTACT US
          </a>
        </div>
      </header>
    )
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
        <Link
          href={user ? ROLE_HOME[user.role] : "/"}
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          <Logo className="h-10 sm:h-14 md:h-20" />
          <span className="sr-only">AdsBender</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
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
              {/* Least essential of the three CTAs, and it has its own
                  dedicated page — dropped below sm so "Log in" / "Sign up"
                  have room to fit next to the logo without wrapping the
                  header or forcing horizontal scroll on phones. The
                  hidden/inline-flex toggle lives on this wrapper rather
                  than the .btn-halo span itself: .btn-halo sets its own
                  `display` in globals.css outside Tailwind's utility
                  layer, so it always wins a same-element specificity tie
                  against the `hidden` utility. */}
              {/* Same "dropped below sm to make room" treatment as
                  "Schedule a meeting" below — a plain text link rather than
                  a bordered pill so it doesn't compete with the Log in /
                  Sign up CTAs for attention; it's a secondary path into the
                  same /login flow, just role-preselected (see
                  home-view.tsx's hero link for the matching entry point). */}
              <Link
                href="/login?role=PUBLISHER&next=/publisher"
                className="hidden shrink-0 whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-violet-600 md:inline"
              >
                For Publishers
              </Link>
              <span className="hidden sm:inline-flex">
                <span className="btn-halo">
                  <Button
                    asChild
                    size="lg"
                    className="btn-shine rounded-full bg-gradient-to-r from-violet-600 to-blue-500 px-6 text-white hover:from-violet-700 hover:to-blue-600"
                  >
                    <Link href="/schedule-meeting">Schedule a meeting</Link>
                  </Button>
                </span>
              </span>
              <span className="btn-halo">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="btn-shine rounded-full border-violet-300 px-3 text-violet-600 hover:bg-white hover:text-violet-600 sm:px-6"
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
