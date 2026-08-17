import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PREFIXES = ["/publisher", "/advertiser", "/analytics"]

// Coarse gate: only checks that the httpOnly `token` cookie is present
// (Next.js can read httpOnly cookies server-side even though client JS
// can't). It can't verify the JWT signature or role here without sharing
// JWT_SECRET, so real authorization still happens in the NestJS API via
// JwtAuthGuard/RolesGuard — this just avoids flashing protected pages to
// signed-out visitors and redirects them straight to /login.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )

  if (!isProtected) {
    return NextResponse.next()
  }

  const token = request.cookies.get("token")
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/publisher/:path*", "/advertiser/:path*", "/analytics/:path*"],
}
