import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarClock, Handshake, Mail, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { contactPageJsonLd, jsonLdScriptProps } from "@/lib/seo"

// TODO(seo): support@adsbender.example is the same placeholder inbox used
// in site-footer.tsx and site-header.tsx — it isn't a real, monitored
// address (see the "demo network" comment on site-footer.tsx). This page
// is noindexed below for exactly that reason: a search result promising a
// way to reach AdsBender shouldn't point at an inbox nobody reads. Once a
// real support email (or a form wired to the backend) exists, swap every
// occurrence of this address — there are three — and lift the noindex.
const CONTACT_EMAIL = "support@adsbender.example"

const TITLE = "Contact"
const DESCRIPTION =
  "Get in touch with the AdsBender team about advertising campaigns, publisher monetization, or a general question."

const ROUTES = [
  {
    icon: Megaphone,
    title: "Advertising",
    description: "Questions about launching a campaign, targeting, or pricing models.",
    cta: "Get started as an advertiser",
    href: "/login?tab=register&role=ADVERTISER",
  },
  {
    icon: Handshake,
    title: "Publisher monetization",
    description: "Questions about ad zones, approval, or payouts.",
    cta: "Get started as a publisher",
    href: "/login?tab=register&role=PUBLISHER",
  },
  {
    icon: CalendarClock,
    title: "Talk to the team",
    description: "Prefer a live conversation over email? Book time directly.",
    cta: "Schedule a meeting",
    href: "/schedule-meeting",
  },
]

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  // Placeholder contact channel (see CONTACT_EMAIL above) — not a page a
  // search result should send someone to yet. Mirrors the same treatment
  // as /schedule-meeting until a real inbox/form exists.
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

      {/* Routes */}
      <section className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {ROUTES.map((route) => (
            <div key={route.title} className="flex flex-col rounded-2xl border bg-card p-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <route.icon className="size-5" />
              </div>
              <p className="mt-4 font-medium">{route.title}</p>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {route.description}
              </p>
              <Button asChild variant="link" className="mt-4 justify-start px-0 text-violet-600">
                <Link href={route.href}>
                  {route.cta}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
