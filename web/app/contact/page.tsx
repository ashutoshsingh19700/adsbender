import type { Metadata } from "next"
import { Mail } from "lucide-react"

import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { contactPageJsonLd, jsonLdScriptProps } from "@/lib/seo"

const CONTACT_EMAIL = "support@adsbender.com"

const TITLE = "Contact"
const DESCRIPTION =
  "Get in touch with the AdsBender team about advertising campaigns, publisher monetization, or a general question."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  robots: { index: false, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/contact" },
}

export default function ContactPage() {
  return (
    <div>
      <script {...jsonLdScriptProps(contactPageJsonLd({ path: "/contact", description: DESCRIPTION }))} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            Contact AdsBender
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Talk to the team
          </h1>
          <p className="mt-5 text-muted-foreground">
            Whether you&apos;re setting up your first campaign, adding an ad
            zone, or just have a question, here&apos;s the fastest way to
            reach us.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:underline"
          >
            <Mail className="size-4" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>
    </div>
  )
}
