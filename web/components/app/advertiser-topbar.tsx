"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, LogOut, Mail, Search } from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import { Button } from "@/components/ui/button"

// Top bar for the redesigned advertiser shell: search, account email, role
// badge, notifications and avatar. Sits to the right of <AdvertiserSidebar>
// (see advertiser/layout.tsx) - the sidebar itself no longer carries the
// account footer now that this identity strip exists up top.
export function AdvertiserTopbar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initial = user?.email?.[0]?.toUpperCase() ?? "A"

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    router.push("/")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search campaigns, stats, or help..."
          className="h-9 w-full rounded-full border bg-muted/40 pl-9 pr-14 text-sm outline-none placeholder:text-muted-foreground focus:border-violet-300 focus:bg-background focus:ring-2 focus:ring-violet-100"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {user?.email ? (
          <span className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
            <Mail className="size-4" />
            {user.email}
          </span>
        ) : null}

        <span className="role-badge-gradient rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-white">
          {user?.role ?? "ADVERTISER"}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500" />
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="sidebar-pill-gradient flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
          >
            {initial}
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
              {user?.email ? (
                <div className="border-b px-3 py-2">
                  <p className="truncate text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user?.role ?? "ADVERTISER"}</p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
