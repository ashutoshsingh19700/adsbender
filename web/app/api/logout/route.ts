import { NextResponse } from "next/server"

// The backend never exposes a logout endpoint (the JWT cookie is httpOnly,
// so client JS can't clear it directly). Browsers scope cookies by hostname
// and path only (not port), so a same-hostname response clearing the
// `token` cookie here also clears the cookie the backend set — this works
// in dev (both on `localhost`, different ports) and in prod (same origin).
export async function POST() {
  const response = NextResponse.json({ message: "Logged out" })
  response.cookies.set("token", "", { path: "/", maxAge: 0 })
  return response
}
