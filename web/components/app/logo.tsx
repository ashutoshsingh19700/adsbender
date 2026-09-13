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
//
// NOTE: We intentionally do NOT use the native `loop` attribute. The
// browser's built-in loop restarts playback so quickly that the first frame
// renders twice back-to-back, creating a visible "double-start" stutter.
// Instead we listen for `ended`, wait one rAF, then manually seek + play —
// that gives the compositor a full frame to settle and produces a clean
// loop with no duplicate-start flicker.
export function Logo({ className }: LogoProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Seamless manual loop — avoids the double-start glitch that the
    // native `loop` attribute causes.
    function handleEnded() {
      if (!video) return
      video.currentTime = 0
      // Wait one frame before replaying so the browser doesn't flash the
      // first frame twice.
      requestAnimationFrame(() => {
        video.play().catch(() => {
          // Autoplay blocked — fall back to a static frame.
          video.currentTime = 0.5
        })
      })
    }

    // Kick off initial playback. If the browser blocks autoplay (common
    // on mobile before any user gesture), seek to a frame where the logo
    // is fully drawn so it still reads as a static mark.
    function play() {
      if (!video) return
      video.currentTime = 0
      video.play().catch(() => {
        video.currentTime = 0.5
      })
    }

    video.addEventListener("ended", handleEnded)

    if (video.readyState >= 1) {
      play()
    } else {
      video.addEventListener("loadedmetadata", play, { once: true })
    }

    return () => {
      video.removeEventListener("ended", handleEnded)
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
        autoPlay
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noremoteplayback"
        x-webkit-airplay="deny"
        preload="auto"
        aria-hidden="true"
      />
    </span>
  )
}
