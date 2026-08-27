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
  async redirects() {
    return [
      {
        // "/book-call" is the URL named in the SEO plan as the eventual
        // home for a real booking calendar (see /schedule-meeting's own
        // noindex comment). No calendar is wired up yet, so rather than
        // duplicate that page's placeholder content under a second URL,
        // this just points /book-call at it. Temporary (not permanent)
        // because the redirect's target/direction may well flip once a
        // real booking widget lands — a 308 here would get cached longer
        // than that decision should be locked in for.
        source: "/book-call",
        destination: "/schedule-meeting",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
