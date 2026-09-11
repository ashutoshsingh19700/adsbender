"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { BARE_CHROME_PATHS, ROLE_HOME } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { SignUpDialog } from "@/components/app/signup-dialog"
import { Logo } from "@/components/app/logo"
import { MobileSidebarTrigger } from "@/components/app/mobile-sidebar"

// Signed-in nav (Websites, Statistics, Earnings, Admin, etc.) and account
// chrome (email, role, log out) live in the left sidebar now — see
// app-sidebar.tsx / advertiser-sidebar.tsx / sidebar-account-footer.tsx.
// This bar is only the brand mark plus the signed-out marketing CTAs.
export function SiteHeader() {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // The auth pages (login/register, forgot/reset password, either role) use
  // their own minimal bar — just the logo and a contact link, no nav or
  // auth CTAs since the user is already there.
  if (BARE_CHROME_PATHS.includes(pathname)) {
    return (
      <header className="bg-background sticky top-0 z-40">
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
            className="text-sm font-medium tracking-wide text-muted-foreground hover:text-orange-600"
          >
            CONTACT US
          </a>
        </div>
      </header>
    )
  }

  // Signed-in chrome (logo, email, role, log out) now lives at the foot of
  // the in-app sidebar (see sidebar-account-footer.tsx) instead of up here,
  // freeing the full header height for page content on desktop. This bar
  // only survives for signed-in users at mobile widths, where there's no
  // sidebar, purely to host the drawer trigger.
  if (!loading && user) {
    return (
      <header className="bg-background sticky top-0 z-40 md:hidden">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
          <MobileSidebarTrigger />
          <Link
            href={ROLE_HOME[user.role]}
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Logo className="h-8" />
            <span className="sr-only">AdsBender</span>
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className="bg-background sticky top-0 z-40">
      <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
        <div className="flex items-center gap-2 sm:gap-3">
          <MobileSidebarTrigger />
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
          >
            <Logo className="h-10 sm:h-14 md:h-20" />
            <span className="sr-only">AdsBender</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {loading ? null : (
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
                    className="btn-shine brand-gradient rounded-full px-6 text-white"
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
                  className="btn-shine rounded-full border-orange-300 px-3 text-orange-600 hover:bg-white hover:text-orange-600 sm:px-6"
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
