import { ImageResponse } from "next/og"

// Square brand mark served as a plain PNG for consumers that need a static
// image URL (Organization JSON-LD `logo`, favicons on platforms that want
// >180px art) — the real header logo is a video (components/app/logo.tsx)
// and can't be used there.

export const runtime = "edge"

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)",
          color: "white",
          fontFamily: "sans-serif",
          fontSize: 220,
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    { width: 512, height: 512 },
  )
}
