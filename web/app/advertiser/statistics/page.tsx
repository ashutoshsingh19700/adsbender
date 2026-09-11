import { redirect } from "next/navigation"

// Statistics now lives on the advertiser dashboard itself.
export default function Page() {
  redirect("/advertiser")
}
