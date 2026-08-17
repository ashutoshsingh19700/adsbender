import { RequireRole } from "@/components/app/require-role"

import { AdvertiserWalletPage } from "./wallet-page"

export default function Page() {
  return (
    <RequireRole roles={["ADVERTISER"]}>
      <AdvertiserWalletPage />
    </RequireRole>
  )
}
