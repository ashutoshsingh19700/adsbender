"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface LogoProps {
  // Height controls the scale (h-8 in the header, h-6 in the signup
  // dialog) — width is left to auto so the video's own aspect ratio is
  // never cropped.
  className?: string
}

// Animated brand mark used wherever the old static orange "A" square + the
// "AdsBender" text used to sit — this animation already renders the full
// AdsBender logo (mark + wordmark), so it replaces both rather than sitting
// next to a duplicate text label. Muted + inline + autoPlay so it behaves
// like an image (no controls, no sound, no fullscreen takeover on mobile
// Safari).
//
// The video bakes in some white padding around the actual mark + wordmark,
// so we render the video oversized and shifted inside an overflow-hidden
// wrapper cropped to the logo's bounding box, so what's visible fills the
// box edge-to-edge. That crop is expressed as percentages so it stays
// correct at any size `className` sets.
export function Logo({ className }: LogoProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  // Play the full animation from the start and loop it continuously.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function play() {
      if (!video) return
      video.currentTime = 0
      video.play().catch(() => {
        // Autoplay can be blocked before any user gesture — common on
        // mobile browsers on first load. The video then just sits on
        // whatever frame `currentTime` last landed on; frame 0 of this
        // clip is a blank fade-in, so left alone the header shows no
        // logo at all. Seeking past that (still allowed without a
        // gesture — only .play() is gated) lands on a frame with the
        // mark fully drawn, so it still reads as a static logo.
        video.currentTime = 0.5
      })
    }

    if (video.readyState >= 1) {
      play()
    } else {
      video.addEventListener("loadedmetadata", play, { once: true })
    }

    return () => {
      video.removeEventListener("loadedmetadata", play)
    }
  }, [])

  return (
    <span
      className={cn(
        "relative inline-block aspect-[1036/374] h-20 shrink-0 overflow-hidden align-middle",
        className
      )}
    >
      <video
        ref={videoRef}
        className="absolute left-0 top-0 h-[192.5%] w-auto max-w-none -translate-x-[13.67%] -translate-y-[23%] mix-blend-multiply brightness-[1.15]"
        src="/brand/adsbender-logo-animation.mp4"
        muted
        loop
        autoPlay
        playsInline
        disablePictureInPicture
        preload="auto"
        aria-hidden="true"
      />
    </span>
  )
}
