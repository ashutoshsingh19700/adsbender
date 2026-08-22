"use client"

import * as React from "react"
import Script from "next/script"

import { ApiError, googleAuth } from "@/lib/api"
import type { UserRole } from "@/lib/types"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            container: HTMLElement,
            options: Record<string, unknown>
          ) => void
        }
      }
    }
  }
}

interface GoogleSignInButtonProps {
  // Only sent (and only required server-side) the first time this Google
  // account signs in - picks which side of the marketplace a brand-new
  // account belongs to. Ignored for an existing account.
  role: UserRole
  onSuccess: (user: Awaited<ReturnType<typeof googleAuth>>["user"]) => void
  onError: (message: string) => void
  // Matches the surrounding form's mode so the button reads "Sign up with
  // Google" on the register tab and "Sign in with Google" on login, instead
  // of the generic "Continue with Google" for both.
  mode?: "login" | "register"
}

export function GoogleSignInButton({
  role,
  onSuccess,
  onError,
  mode = "login",
}: GoogleSignInButtonProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scriptReady, setScriptReady] = React.useState(false)

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  React.useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.google || !clientId) {
      return
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const { user } = await googleAuth({
            idToken: response.credential,
            role,
          })
          onSuccess(user)
        } catch (error) {
          onError(
            error instanceof ApiError ? error.message : "Google sign-in failed"
          )
        }
      },
    })

    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: 320,
      text: mode === "register" ? "signup_with" : "signin_with",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, clientId, role, mode])

  if (!clientId) {
    // Not configured - hide the option entirely rather than rendering a
    // button that would 500 on click. See GOOGLE_CLIENT_ID in
    // backend/.env.example / NEXT_PUBLIC_GOOGLE_CLIENT_ID below.
    return null
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onReady={() => setScriptReady(true)}
      />
      <div className="flex justify-center" ref={containerRef} />
    </>
  )
}
