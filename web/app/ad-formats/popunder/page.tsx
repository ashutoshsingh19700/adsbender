import type { Metadata } from "next"

import { jsonLdScriptProps, serviceJsonLd } from "@/lib/seo"

import { PopunderView } from "./popunder-view"

const TITLE = "Popunder Ads — High-Volume Ad Format"
const DESCRIPTION =
  "Run CPM or CPA Popunder campaigns backed by a growing base of publisher inventory, or add a Popunder zone to your site and start collecting payouts in minutes."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ad-formats/popunder" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/ad-formats/popunder" },
}

export default function Page() {
  return (
    <>
      <script
        {...jsonLdScriptProps(
          serviceJsonLd({
            name: "Popunder Ads",
            description: DESCRIPTION,
            path: "/ad-formats/popunder",
            serviceType: "Popunder advertising",
          }),
        )}
      />
      <PopunderView />
    </>
  )
}
