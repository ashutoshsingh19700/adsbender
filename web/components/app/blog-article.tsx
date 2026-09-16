import { cn } from "@/lib/utils"

// Hand-styled article typography instead of @tailwindcss/typography (not
// installed) — arbitrary-child selectors are already the pattern this repo
// uses for one-off nested styling (see buttonVariants' `[&_svg]` rules).
export function BlogArticle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "max-w-3xl text-foreground",
        "[&>p]:mt-4 [&>p]:font-medium [&>p]:leading-relaxed [&>p]:text-foreground/75",
        "[&>h2]:mt-12 [&>h2]:text-2xl [&>h2]:font-extrabold [&>h2]:tracking-tight [&>h2]:text-foreground",
        "[&>h3]:mt-8 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:tracking-tight [&>h3]:text-foreground",
        "[&>ul]:mt-4 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul]:font-medium [&>ul]:text-foreground/75",
        "[&>ol]:mt-4 [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-5 [&>ol]:font-medium [&>ol]:text-foreground/75",
        "[&_strong]:font-bold [&_strong]:text-foreground",
        "[&>blockquote]:mt-6 [&>blockquote]:border-l-2 [&>blockquote]:border-violet-300 [&>blockquote]:pl-4 [&>blockquote]:font-medium [&>blockquote]:text-foreground/85 [&>blockquote]:italic",
        className,
      )}
    >
      {children}
    </div>
  )
}
