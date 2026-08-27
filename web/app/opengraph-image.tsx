import { ImageResponse } from "next/og"

// Default OG/Twitter share card for every route that doesn't define its own
// opengraph-image.tsx. Generated at request time (cached by Next) instead of
// shipping a static PNG, so it never drifts from the brand gradient used in
// the actual UI (see app/page.tsx's hero).

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>
          AdsBender
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          One platform. All your campaigns. Better results.
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, opacity: 0.9 }}>
          adsbender.com — Ad network for advertisers &amp; publishers
        </div>
      </div>
    ),
    { ...size },
  )
}
