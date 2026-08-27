import type { Metadata } from "next"

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  jsonLdScriptProps,
  serviceJsonLd,
} from "@/lib/seo"

import { HomeView } from "./home-view"

// The page itself is a server component so it can export metadata — the
// actual hero/offer UI is a client component (auth-aware redirect,
// interactive offer picker) in ./home-view.tsx. This split is the standard
// pattern for any route that needs both `"use client"` and `metadata`.
export const metadata: Metadata = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
  },
}

export default function Page() {
  return (
    <>
      <script
        {...jsonLdScriptProps(
          serviceJsonLd({
            name: "AdsBender Ad Network",
            description: DEFAULT_DESCRIPTION,
            path: "/",
            serviceType: "Online advertising network",
          }),
        )}
      />
      <HomeView />
    </>
  )
}
