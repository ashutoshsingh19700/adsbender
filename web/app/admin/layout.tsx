import type { Metadata } from "next"

// Authenticated account area — never a search result. robots.ts also
// disallows crawling this prefix; this noindex is the belt to that
// suspenders (covers the case a link to it leaks in from elsewhere).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
