"use client"

import { usePathname } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { BARE_CHROME_PATHS } from "@/lib/roles"
import { AppSidebar } from "@/components/app/app-sidebar"

// Sits between the header and footer in the root layout. Signed-out
// visitors (marketing pages, login, etc.) get exactly the old plain,
// full-width <main> - the sidebar + constrained-width shell only kicks in
// once someone is signed in. BARE_CHROME_PATHS also opts out even when
// `user` is set - see its comment in lib/roles.ts for why a still-signed-in
// visit to /login shouldn't show the sidebar either.
//
// /advertiser/* and /publisher/* each render their own, more detailed
// sidebar (AdvertiserSidebar / PublisherSidebar, via their own layout.tsx) -
// showing this generic one there too would stack two sidebars side by side,
// so both sections are skipped here.
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user || BARE_CHROME_PATHS.includes(pathname)) {
    return <main className="flex-1 pt-6">{children}</main>
  }

  // No pt-6 here (unlike the two returns above) - the advertiser/publisher
  // sidebar + sticky topbar are meant to sit flush against the top of the
  // viewport, matching the reference dashboard design. Adding top padding
  // pushed the whole shell down and left a blank strip above the topbar.
  //
  // /analytics is shared across all three roles (ADVERTISER, PUBLISHER,
  // ADMIN) - its own layout.tsx picks the matching sidebar per role, so it
  // needs the same bare wrapper as /advertiser and /publisher rather than
  // the generic AppSidebar below (which would stack a second sidebar next
  // to the role-specific one).
  if (
    pathname === "/advertiser" ||
    pathname.startsWith("/advertiser/") ||
    pathname === "/publisher" ||
    pathname.startsWith("/publisher/") ||
    pathname === "/analytics"
  ) {
    return <main className="flex-1">{children}</main>
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-start gap-6 px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
      <AppSidebar />
      <main className="min-w-0 flex-1 pt-6">{children}</main>
    </div>
  )
}
