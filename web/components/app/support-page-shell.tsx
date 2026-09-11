"use client"

import { useAuth } from "@/app/providers/auth-provider"
import { RoleAwareShell } from "@/components/app/role-aware-shell"

// Wraps pages that are public marketing pages for signed-out visitors
// (Help Center, Contact Us) but are also linked from every signed-in
// dashboard's sidebar - those visitors should see their own role's sidebar
// + topbar, not the plain full-width marketing layout, while a genuinely
// signed-out visitor keeps that plain layout untouched.
export function SupportPageShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading || !user) {
    return <>{children}</>
  }

  return <RoleAwareShell>{children}</RoleAwareShell>
}
