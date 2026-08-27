import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { BlogArticle } from "@/components/app/blog-article"
import { blogPostingJsonLd, jsonLdScriptProps } from "@/lib/seo"
import { getAllPosts, getPost, getRelatedPosts } from "@/lib/blog"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const entry = getPost(slug)
  if (!entry) return {}

  const { meta } = entry
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/blog/${meta.slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `/blog/${meta.slug}`,
      type: "article",
      publishedTime: meta.publishedAt,
    },
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const entry = getPost(slug)
  if (!entry) notFound()

  const { meta, Content } = entry
  const related = getRelatedPosts(slug)

  return (
    <div>
      <script
        {...jsonLdScriptProps(
          blogPostingJsonLd({
            title: meta.title,
            description: meta.description,
            path: `/blog/${meta.slug}`,
            datePublished: meta.publishedAt,
          }),
        )}
      />

      <article>
        <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Blog", path: "/blog" },
              { name: meta.title, path: `/blog/${meta.slug}` },
            ]}
          />

          <div className="mt-6 flex items-center gap-3">
            <Badge variant="outline" className="text-violet-600">
              {meta.category}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {meta.readingTimeMinutes} min read
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {meta.title}
          </h1>
          <time
            dateTime={meta.publishedAt}
            className="mt-3 block text-sm text-muted-foreground"
          >
            {dateFormatter.format(new Date(meta.publishedAt))}
          </time>

          <BlogArticle className="mt-8">
            <Content />
          </BlogArticle>
        </section>
      </article>

      <Separator className="mx-auto max-w-2xl" />

      {/* Related posts / CTA */}
      <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
        {related.length > 0 && (
          <div className="mb-10">
            <p className="text-sm font-medium text-muted-foreground">
              More on {meta.category.toLowerCase()}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {related.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border p-4 hover:border-violet-300"
                >
                  <span className="text-sm font-medium">{post.title}</span>
                  <ArrowRight className="size-4 shrink-0 text-violet-600 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col items-start gap-4 rounded-2xl border bg-violet-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Ready to put this into practice?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse every ad format and pricing model in one place.
            </p>
          </div>
          <Button
            asChild
            className="bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:from-violet-700 hover:to-blue-600"
          >
            <Link href="/services">
              Browse services
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
