"use client"

import * as React from "react"
import Script from "next/script"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

// Cloudflare's documented "always passes" test key
// (https://developers.cloudflare.com/turnstile/troubleshooting/testing/) -
// used as a fallback so local dev and preview deploys can still exercise
// the full login/signup flow before a real site key is configured. Set
// NEXT_PUBLIC_TURNSTILE_SITE_KEY to the real key from
// https://dash.cloudflare.com/?to=/:account/turnstile for production.
const TEST_SITE_KEY = "1x00000000000000000000AA"

export interface TurnstileWidgetHandle {
  reset: () => void
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  className?: string
}

export const TurnstileWidget = React.forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget({ onVerify, onExpire, className }, ref) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const widgetIdRef = React.useRef<string | undefined>(undefined)
  const [scriptReady, setScriptReady] = React.useState(false)

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY

  React.useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.turnstile) return

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onVerify(token),
      "expired-callback": () => onExpire?.(),
      "error-callback": () => onExpire?.(),
    })

    return () => {
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current)
        widgetIdRef.current = undefined
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, siteKey])

  React.useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current) {
        window.turnstile?.reset(widgetIdRef.current)
      }
    },
  }))

  return (
    <>
      {/* afterInteractive (default) is fine here - Turnstile is a bot
          check on form submission, not something that needs to beat
          hydration. */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className={className} />
    </>
  )
})
