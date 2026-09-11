import { RoleAwareShell } from "@/components/app/role-aware-shell"

// /analytics is shared across ADVERTISER, PUBLISHER and ADMIN - see
// RoleAwareShell for why it needs its own layout instead of AppShell's
// generic AppSidebar.
export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RoleAwareShell>{children}</RoleAwareShell>
}
