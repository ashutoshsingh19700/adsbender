import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { breadcrumbJsonLd, jsonLdScriptProps, type BreadcrumbItem } from "@/lib/seo"
import { cn } from "@/lib/utils"

// Renders the visible breadcrumb trail AND its BreadcrumbList JSON-LD from
// the same `items` array, so the two can never drift apart — Google
// discounts (or acts on as spam) structured data that doesn't match what's
// actually on the page.
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  return (
    <>
      <script {...jsonLdScriptProps(breadcrumbJsonLd(items))} />
      <nav aria-label="Breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            return (
              <li key={item.path} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
                {isLast ? (
                  <span aria-current="page" className="font-medium text-foreground">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.path} className="hover:text-violet-600">
                    {item.name}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
