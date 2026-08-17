import type { UserRole } from "@/lib/types"

// Where each role lands after login / when visiting "/" while authenticated.
export const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: "/admin",
  ADVERTISER: "/advertiser",
  PUBLISHER: "/publisher",
}
