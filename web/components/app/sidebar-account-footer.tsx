"use client"

import { useRouter } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Account identity + logout, now living at the foot of the in-app sidebars
// instead of the top marketing header — see site-header.tsx, which drops
// to a slim mobile-only bar once a user is signed in and no longer carries
// this itself.
export function SidebarAccountFooter() {
  const { user, logout } = useAuth()
  const router = useRouter()

  if (!user) return null

  async function handleLogout() {
    await logout()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {user.email}
        </p>
        <Badge variant="outline" className="mt-1">
          {user.role}
        </Badge>
      </div>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  )
}
