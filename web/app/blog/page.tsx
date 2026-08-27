import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { getAllPosts } from "@/lib/blog"

const TITLE = "Blog"
const DESCRIPTION =
  "Guides on ad formats, pricing models, and monetization from the AdsBender network — how to choose between them and what actually changes conversion."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/blog" },
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

export default function BlogIndexPage() {
  const posts = getAllPosts()

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
            <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">
            AdsBender Blog
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Ad formats and pricing, explained
          </h1>
          <p className="mt-5 text-muted-foreground">
            Practical guides for choosing between ad formats and pricing
            models, and for running ad zones without hurting site
            performance.
          </p>
        </div>
      </section>

      {/* Post list */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col divide-y">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group py-8 first:pt-0"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-violet-600">
                  {post.category}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {post.readingTimeMinutes} min read
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight group-hover:text-violet-600">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {post.description}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <time dateTime={post.publishedAt}>
                  {dateFormatter.format(new Date(post.publishedAt))}
                </time>
                <span className="inline-flex items-center gap-1 font-medium text-violet-600">
                  Read
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
