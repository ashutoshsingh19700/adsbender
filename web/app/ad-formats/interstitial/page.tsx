import type { Metadata } from "next"

import { jsonLdScriptProps, serviceJsonLd } from "@/lib/seo"

import { InterstitialView } from "./interstitial-view"

const TITLE = "Interstitial Ads — Full-Screen Ad Format"
const DESCRIPTION =
  "Run CPM or CPA Interstitial campaigns timed to natural transition points, or add an Interstitial unit to your site and turn high-attention moments into revenue."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ad-formats/interstitial" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/ad-formats/interstitial" },
}

export default function Page() {
  return (
    <>
      <script
        {...jsonLdScriptProps(
          serviceJsonLd({
            name: "Interstitial Ads",
            description: DESCRIPTION,
            path: "/ad-formats/interstitial",
            serviceType: "Interstitial advertising",
          }),
        )}
      />
      <InterstitialView />
    </>
  )
}
