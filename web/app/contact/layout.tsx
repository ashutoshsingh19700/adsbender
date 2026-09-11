import { SupportPageShell } from "@/components/app/support-page-shell"

// Public marketing page for signed-out visitors, but also linked from every
// signed-in dashboard's sidebar ("Contact Us") - see SupportPageShell for
// why it needs its own layout instead of falling through to AppShell's
// generic AppSidebar for those visitors.
export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SupportPageShell>{children}</SupportPageShell>
}
