import type { Metadata } from "next"
import { CalendarClock, Mail } from "lucide-react"

import { Breadcrumbs } from "@/components/app/breadcrumbs"

// "Booking is coming soon" below — this is placeholder/thin content, not a
// real landing page yet. Indexing it now would put a near-empty page in
// front of searchers and count against thin-content quality signals for
// the rest of the site. Flip `index: true` once the real booking calendar
// and copy land (see SEO report's action plan — /book-call).
export const metadata: Metadata = {
  title: "Schedule a Meeting",
  robots: { index: false, follow: true },
  alternates: { canonical: "/schedule-meeting" },
}

export default function ScheduleMeetingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-violet-50/40 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Breadcrumbs
              items={[
                { name: "Home", path: "/" },
                { name: "Schedule a Meeting", path: "/schedule-meeting" },
              ]}
            />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            Talk to AdsBender
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Schedule a meeting
          </h1>
          <p className="mt-5 font-medium text-foreground/75">
            Booking is coming soon. In the meantime, reach out and our team
            will find a time that works for you.
          </p>
        </div>
      </section>

      {/* Placeholder booking panel */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-12 text-center font-medium text-foreground/75">
          <CalendarClock className="size-10 text-violet-500" />
          <p className="text-sm">
            A booking calendar will be embedded here.
          </p>
          <a
            href="mailto:support@adsbender.com"
            className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:underline"
          >
            <Mail className="size-4" />
            support@adsbender.com
          </a>
        </div>
      </section>
    </div>
  )
}
