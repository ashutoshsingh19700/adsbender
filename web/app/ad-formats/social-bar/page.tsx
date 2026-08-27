import type { Metadata } from "next"

import { jsonLdScriptProps, serviceJsonLd } from "@/lib/seo"

import { SocialBarView } from "./social-bar-view"

const TITLE = "Social Bar Ads — Non-Intrusive Toolbar Ad Format"
const DESCRIPTION =
  "Run CPM, CPC, or CPA campaigns through Social Bar's on-page toolbar, or add it to your site as a lightweight, non-intrusive way to monetize every visitor."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ad-formats/social-bar" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/ad-formats/social-bar" },
}

export default function Page() {
  return (
    <>
      <script
        {...jsonLdScriptProps(
          serviceJsonLd({
            name: "Social Bar Ads",
            description: DESCRIPTION,
            path: "/ad-formats/social-bar",
            serviceType: "Social bar advertising",
          }),
        )}
      />
      <SocialBarView />
    </>
  )
}
