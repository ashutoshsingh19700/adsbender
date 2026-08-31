import type { UserRole } from "@/lib/types"

// Where each role lands after login / when visiting "/" while authenticated.
export const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: "/admin",
  ADVERTISER: "/advertiser",
  PUBLISHER: "/publisher",
}

// Routes that always render bare - no signed-in nav, no sidebar - even for
// a still-authenticated visitor. Shared between SiteHeader (which drops to
// its minimal bar here) and AppShell (which must skip the sidebar here for
// the same reason: someone lands on /login already signed in often enough -
// a stale tab, a bookmarked link, logout redirecting here mid-flight - that
// the authenticated chrome showing up behind the login card is a real bug,
// not just a theoretical one.
export const BARE_CHROME_PATHS = ["/login", "/forgot-password", "/reset-password"]
