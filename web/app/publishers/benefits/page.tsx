import type { Metadata } from "next"

import { jsonLdScriptProps, serviceJsonLd } from "@/lib/seo"

import { BenefitsView } from "./benefits-view"

const TITLE = "Publisher Monetization — Grow Ad Revenue"
const DESCRIPTION =
  "Maximize revenue with a monetization platform built for publishers. Sell traffic and get fair, high CPM rates across Popunder, Social Bar, In-Page Push and Interstitial formats."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/publishers/benefits" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/publishers/benefits" },
}

export default function Page() {
  return (
    <>
      <script
        {...jsonLdScriptProps(
          serviceJsonLd({
            name: "AdsBender Publisher Monetization",
            description: DESCRIPTION,
            path: "/publishers/benefits",
            serviceType: "Website traffic monetization",
          }),
        )}
      />
      <BenefitsView />
    </>
  )
}
