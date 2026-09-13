"use client"

import * as React from "react"

import { Logo } from "@/components/app/logo"
import { cn } from "@/lib/utils"

// Login/registration involves a real network round trip or two (Turnstile
// verify + login, or register -> wait for a fresh captcha token -> login),
// plus the client-side navigation to the destination dashboard - a few
// seconds where the screen would otherwise look frozen. This fills that gap
// with visible motion (a pulsing mark + a shimmering progress bar) and a
// rotating status line, so it reads as "working" rather than "stuck", right
// up until the destination route takes over.
const STEPS = [
  "Verifying your details...",
  "Setting up your workspace...",
  "Loading your dashboard...",
  "Almost there...",
]

export function AuthLoadingOverlay({
  active,
  label,
}: {
  active: boolean
  // Optional fixed label (e.g. "Creating your account...") - when omitted,
  // cycles through STEPS instead.
  label?: string
}) {
  const [stepIndex, setStepIndex] = React.useState(0)

  React.useEffect(() => {
    if (!active || label) return
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length)
    }, 1400)
    return () => clearInterval(interval)
  }, [active, label])

  if (!active) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-100 flex flex-col items-center justify-center gap-5",
        "bg-background/80 backdrop-blur-sm",
        "animate-in fade-in-0 duration-150"
      )}
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute size-16 animate-ping rounded-full bg-violet-500/20" />
        <Logo className="relative h-10" />
      </div>

      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div className="animate-loading-bar h-full w-1/3 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-500" />
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {label ?? STEPS[stepIndex]}
      </p>
    </div>
  )
}
