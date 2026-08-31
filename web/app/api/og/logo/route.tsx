import { NextRequest, NextResponse } from "next/server"

// Kept only for back-compat with anything that already cached/indexed this
// URL (e.g. Organization JSON-LD `logo` used to point here) — the real
// brand mark now lives as a static file, which lib/seo.ts's ORGANIZATION.logo
// points to directly, so this just redirects there instead of duplicating it.

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/brand/adsbender-mark.png", request.url))
}
