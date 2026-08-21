import type { NextConfig } from "next";
import path from "path";

// The backend issues an httpOnly session cookie, and browsers scope cookies
// by hostname - a cookie set by adsbender.onrender.com can never be read by
// this app's own middleware (proxy.ts) checking cookies on the Vercel
// domain, no matter what SameSite says. Rewriting /api/v1/* through this
// app's own origin makes the browser see the cookie as first-party, so it
// actually reaches proxy.ts and gets sent back on subsequent requests.
const backendOrigin =
  process.env.BACKEND_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
