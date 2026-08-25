import { RequireRole } from "@/components/app/require-role"
import { AdvertiserSidebar } from "@/components/app/advertiser-sidebar"

// Shared shell for every /advertiser/* page: role gate + the persistent
// sidebar (Dashboard, Statistics, Campaigns, Add Funds). Individual pages
// only render their own content area.
export default function AdvertiserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireRole roles={["ADVERTISER"]}>
      <div className="mx-auto flex max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]">
        <AdvertiserSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </RequireRole>
  )
}
