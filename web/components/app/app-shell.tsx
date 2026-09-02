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
// /advertiser/* renders its own, more detailed sidebar (AdvertiserSidebar,
// via app/advertiser/layout.tsx) - showing this generic one there too would
// stack two sidebars side by side, so it's skipped for that section.
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user || BARE_CHROME_PATHS.includes(pathname)) {
    return <main className="flex-1 pt-6">{children}</main>
  }

  if (pathname === "/advertiser" || pathname.startsWith("/advertiser/")) {
    return <main className="flex-1 pt-6">{children}</main>
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-start gap-6 px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-[1600px]">
      <AppSidebar />
      <main className="min-w-0 flex-1 pt-6">{children}</main>
    </div>
  )
}
