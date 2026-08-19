"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-provider"
import type { UserRole } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (!roles.includes(user.role)) {
      toast.error(`This page requires the ${roles.join(" or ")} role.`)
      router.replace("/")
    }
  }, [loading, user, roles, router])

  if (loading || !user || !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] space-y-4 px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return <>{children}</>
}
